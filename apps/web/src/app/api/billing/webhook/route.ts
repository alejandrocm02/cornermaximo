import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { constructStripeEvent } from '@/lib/security/stripe-signature';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPremiumPriceId, getStripeClient, isPremiumPriceId } from '@/lib/stripe';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOf(value: string | { id: string } | null): string | null {
  if (typeof value === 'string') return value;
  return value?.id ?? null;
}

async function resolveUserId(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
): Promise<string | null> {
  const metadataUserId = subscription.metadata.supabase_user_id || fallbackUserId;
  if (metadataUserId && UUID_PATTERN.test(metadataUserId)) return metadataUserId;

  const admin = createAdminClient();
  const subscriptionId = subscription.id;
  const customerId = idOf(subscription.customer);

  const { data: bySubscription } = await admin
    .from('billing_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (bySubscription?.user_id) return bySubscription.user_id;
  if (!customerId) return null;

  const { data: byCustomer } = await admin
    .from('billing_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return byCustomer?.user_id ?? null;
}

async function persistPremiumSubscription(
  subscription: Stripe.Subscription,
  event: Stripe.Event,
  fallbackUserId?: string | null,
): Promise<'applied' | 'ignored'> {
  const subscriptionItem = subscription.items.data[0];
  const priceId = subscriptionItem?.price.id ?? null;

  // Never grant Premium for an unrelated Stripe price.
  if (!isPremiumPriceId(priceId)) return 'ignored';

  const userId = await resolveUserId(subscription, fallbackUserId);
  if (!userId || !subscriptionItem) {
    throw new Error('Unable to map the Premium subscription to a valid user.');
  }

  const customerId = idOf(subscription.customer);
  if (!customerId) throw new Error('Stripe subscription has no customer identifier.');

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('apply_stripe_subscription_event', {
    p_user_id: userId,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_price_id: priceId,
    p_status: subscription.status,
    p_current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
    p_current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
    p_cancel_at_period_end: subscription.cancel_at_period_end,
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created: new Date(event.created * 1000).toISOString(),
  });

  if (error) throw error;
  return data ? 'applied' : 'ignored';
}

function isSubscriptionLifecycleEvent(
  event: Stripe.Event,
): event is Stripe.CustomerSubscriptionCreatedEvent | Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent {
  return [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ].includes(event.type);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get('stripe-signature');

  if (!webhookSecret || !process.env.STRIPE_SECRET_KEY?.trim() || !getPremiumPriceId()) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = constructStripeEvent(payload, signature, webhookSecret, getStripeClient());
  } catch {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);

      if (session.mode === 'subscription' && subscriptionId) {
        const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price'],
        });
        await persistPremiumSubscription(
          subscription,
          event,
          session.client_reference_id || session.metadata?.supabase_user_id,
        );
      }
    } else if (isSubscriptionLifecycleEvent(event)) {
      await persistPremiumSubscription(event.data.object, event);
    }
  } catch (error) {
    console.error('Stripe webhook processing failed.', {
      eventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : 'Unknown webhook error',
    });
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
