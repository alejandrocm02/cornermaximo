import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/security/stripe-signature';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeGet } from '@/lib/stripe-rest';

export const runtime = 'nodejs';

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
}

interface StripeSubscriptionItem {
  current_period_start?: number;
  current_period_end?: number;
  price?: { id?: string };
}

interface StripeSubscription {
  id: string;
  customer: string | { id?: string };
  status: string;
  metadata?: Record<string, string>;
  cancel_at_period_end?: boolean;
  items?: { data?: StripeSubscriptionItem[] };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

async function resolveUserId(subscription: StripeSubscription): Promise<string | null> {
  const metadataUserId = subscription.metadata?.supabase_user_id;
  if (metadataUserId && UUID_RE.test(metadataUserId)) return metadataUserId;

  const admin = createAdminClient();
  const customerId = idOf(subscription.customer);
  const query = admin
    .from('billing_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .maybeSingle();

  let { data } = await query;
  if (data?.user_id) return data.user_id as string;

  if (customerId) {
    const result = await admin
      .from('billing_subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();
    data = result.data;
    if (data?.user_id) return data.user_id as string;
  }

  return null;
}

async function persistSubscription(
  subscription: StripeSubscription,
  event: StripeEvent,
  fallbackUserId?: string | null,
) {
  if (!subscription.id || !subscription.status) {
    throw new Error('Invalid Stripe subscription payload.');
  }

  const admin = createAdminClient();
  const userId = fallbackUserId && UUID_RE.test(fallbackUserId)
    ? fallbackUserId
    : await resolveUserId(subscription);
  if (!userId) throw new Error('Unable to resolve Supabase user for Stripe subscription.');

  const customerId = idOf(subscription.customer);
  const primaryItem = subscription.items?.data?.[0];
  const priceId = primaryItem?.price?.id ?? null;
  const toIso = (seconds?: number) =>
    typeof seconds === 'number' && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString()
      : null;

  const { error } = await admin.rpc('apply_stripe_subscription_event', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created: new Date(event.created * 1000).toISOString(),
    p_user_id: userId,
    p_status: subscription.status,
    p_customer_id: customerId,
    p_subscription_id: subscription.id,
    p_price_id: priceId,
    p_current_period_start: toIso(primaryItem?.current_period_start),
    p_current_period_end: toIso(primaryItem?.current_period_end),
    p_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
  });

  if (error) throw error;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: 'Webhook configuration missing.' }, { status: 400 });
  }

  const payload = await request.text();
  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Partial<StripeEvent>).id !== 'string' ||
      typeof (parsed as Partial<StripeEvent>).type !== 'string' ||
      typeof (parsed as Partial<StripeEvent>).created !== 'number' ||
      !Number.isFinite((parsed as Partial<StripeEvent>).created) ||
      !(parsed as Partial<StripeEvent>).data ||
      typeof (parsed as Partial<StripeEvent>).data?.object !== 'object'
    ) {
      throw new Error('Invalid Stripe event shape.');
    }
    event = parsed as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      const fallbackUserId =
        typeof session.client_reference_id === 'string'
          ? session.client_reference_id
          : typeof (session.metadata as Record<string, unknown> | undefined)?.supabase_user_id === 'string'
            ? String((session.metadata as Record<string, unknown>).supabase_user_id)
            : null;

      if (subscriptionId) {
        const subscription = await stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
        await persistSubscription(subscription, event, fallbackUserId);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await persistSubscription(event.data.object as unknown as StripeSubscription, event);
    }
  } catch {
    // Non-2xx makes Stripe retry the event, which is safer than silently losing entitlement changes.
    return NextResponse.json({ error: 'Subscription sync failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
