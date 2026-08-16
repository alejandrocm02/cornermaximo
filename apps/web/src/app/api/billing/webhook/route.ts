import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripeGet } from '@/lib/stripe-rest';

export const runtime = 'nodejs';

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

interface StripeSubscription {
  id: string;
  customer: string | { id?: string };
  status: string;
  metadata?: Record<string, string>;
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_TOLERANCE_SECONDS = 300;

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const item of header.split(',')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return signatures.some((signature) => {
    const provided = Buffer.from(signature, 'utf8');
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });
}

async function resolveUserId(subscription: StripeSubscription): Promise<string | null> {
  const metadataUserId = subscription.metadata?.supabase_user_id;
  if (metadataUserId && UUID_RE.test(metadataUserId)) return metadataUserId;

  const admin = createAdminClient();
  const customerId = idOf(subscription.customer);
  let query = admin
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

async function persistSubscription(subscription: StripeSubscription, fallbackUserId?: string | null) {
  const admin = createAdminClient();
  const userId = fallbackUserId && UUID_RE.test(fallbackUserId)
    ? fallbackUserId
    : await resolveUserId(subscription);
  if (!userId) throw new Error('Unable to resolve Supabase user for Stripe subscription.');

  const customerId = idOf(subscription.customer);
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const toIso = (seconds?: number) =>
    typeof seconds === 'number' && Number.isFinite(seconds)
      ? new Date(seconds * 1000).toISOString()
      : null;

  const { error } = await admin.from('billing_subscriptions').upsert(
    {
      user_id: userId,
      plan: 'PRO',
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      current_period_start: toIso(subscription.current_period_start),
      current_period_end: toIso(subscription.current_period_end),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

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
    event = JSON.parse(payload) as StripeEvent;
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
        await persistSubscription(subscription, fallbackUserId);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await persistSubscription(event.data.object as unknown as StripeSubscription);
    }
  } catch {
    // Non-2xx makes Stripe retry the event, which is safer than silently losing entitlement changes.
    return NextResponse.json({ error: 'Subscription sync failed.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
