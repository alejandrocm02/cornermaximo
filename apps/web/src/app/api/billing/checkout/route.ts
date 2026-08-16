import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { stripePost } from '@/lib/stripe-rest';

interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

const MANAGED_PAYMENTS_API_VERSION = '2026-03-04.preview';

function backToPro(reason: string) {
  return NextResponse.redirect(`${getSiteUrl()}/pro?billing=${encodeURIComponent(reason)}`, 303);
}

export async function POST() {
  const priceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  if (!process.env.STRIPE_SECRET_KEY || !priceId) return backToPro('unavailable');

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.redirect(`${getSiteUrl()}/auth/login?next=/pro`, 303);
  }

  const { data: billing } = await supabase
    .from('billing_subscriptions')
    .select('stripe_customer_id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (billing?.status && ['active', 'trialing'].includes(billing.status.toLowerCase())) {
    return NextResponse.redirect(`${getSiteUrl()}/pro?billing=already-active`, 303);
  }

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('managed_payments[enabled]', 'true');
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${getSiteUrl()}/pro?checkout=success`);
  params.set('cancel_url', `${getSiteUrl()}/pro?checkout=cancelled`);
  params.set('client_reference_id', user.id);
  params.set('metadata[supabase_user_id]', user.id);
  params.set('subscription_data[metadata][supabase_user_id]', user.id);
  params.set('allow_promotion_codes', 'true');

  if (billing?.stripe_customer_id) {
    params.set('customer', billing.stripe_customer_id);
  } else if (user.email) {
    params.set('customer_email', user.email);
  }

  try {
    const session = await stripePost<StripeCheckoutSession>('/checkout/sessions', params, {
      apiVersion: MANAGED_PAYMENTS_API_VERSION,
    });
    if (!session.url) return backToPro('checkout-url-missing');
    return NextResponse.redirect(session.url, 303);
  } catch {
    return backToPro('checkout-error');
  }
}
