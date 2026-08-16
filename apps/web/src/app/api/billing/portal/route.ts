import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { stripePost } from '@/lib/stripe-rest';

interface StripePortalSession {
  url: string;
}

function backToPro(reason: string) {
  return NextResponse.redirect(`${getSiteUrl()}/pro?billing=${encodeURIComponent(reason)}`, 303);
}

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) return backToPro('unavailable');

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
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!billing?.stripe_customer_id) return backToPro('customer-missing');

  const params = new URLSearchParams();
  params.set('customer', billing.stripe_customer_id);
  params.set('return_url', `${getSiteUrl()}/pro`);

  try {
    const portal = await stripePost<StripePortalSession>('/billing_portal/sessions', params);
    return NextResponse.redirect(portal.url, 303);
  } catch {
    return backToPro('portal-error');
  }
}
