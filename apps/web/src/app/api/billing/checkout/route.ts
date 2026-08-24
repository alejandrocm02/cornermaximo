import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBillingReturnUrl } from '@/lib/site-url';
import { isSameOriginBillingRequest } from '@/lib/security/billing-request';
import {
  getCheckoutIntegrationIdentifier,
  getPremiumPriceId,
  getStripeClient,
  isManagedPaymentsEnabled,
} from '@/lib/stripe';

export const runtime = 'nodejs';

function backToPro(reason: string) {
  return NextResponse.redirect(`${getBillingReturnUrl()}/pro?billing=${encodeURIComponent(reason)}`, 303);
}

function checkoutIdempotencyKey(userId: string, priceId: string): string {
  const fiveMinuteWindow = Math.floor(Date.now() / 300_000);
  return `cornermaximo-checkout-${createHash('sha256')
    .update(`${userId}:${priceId}:${fiveMinuteWindow}`)
    .digest('hex')}`;
}

export async function POST(request: Request) {
  if (!isSameOriginBillingRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const priceId = getPremiumPriceId();
  if (!process.env.STRIPE_SECRET_KEY || !priceId || !isManagedPaymentsEnabled()) {
    return backToPro('unavailable');
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${getBillingReturnUrl()}/auth/login?next=/pro`, 303);
  }

  const { data: billing } = await supabase
    .from('billing_subscriptions')
    .select('stripe_customer_id,stripe_price_id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (
    billing?.stripe_price_id === priceId &&
    billing.status &&
    ['active', 'trialing'].includes(billing.status.toLowerCase())
  ) {
    return NextResponse.redirect(`${getBillingReturnUrl()}/pro?billing=already-active`, 303);
  }

  try {
    const session = await getStripeClient().checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${getBillingReturnUrl()}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBillingReturnUrl()}/pro?checkout=cancelled`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        cornermaximo_plan: 'PREMIUM',
      },
      subscription_data: {
        billing_mode: { type: 'flexible' },
        metadata: {
          supabase_user_id: user.id,
          cornermaximo_plan: 'PREMIUM',
        },
      },
      allow_promotion_codes: true,
      managed_payments: { enabled: true },
      integration_identifier: getCheckoutIntegrationIdentifier(),
      origin_context: 'web',
      ...(billing?.stripe_customer_id
        ? { customer: billing.stripe_customer_id }
        : user.email
          ? { customer_email: user.email }
          : {}),
    }, {
      idempotencyKey: checkoutIdempotencyKey(user.id, priceId),
    });

    if (!session.url) return backToPro('checkout-url-missing');
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error('Stripe Checkout Session creation failed.', {
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown Stripe error',
    });
    return backToPro('checkout-error');
  }
}
