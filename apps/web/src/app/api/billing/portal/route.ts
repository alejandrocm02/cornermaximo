import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBillingReturnUrl } from '@/lib/site-url';
import { isSameOriginBillingRequest } from '@/lib/security/billing-request';
import { getStripeClient } from '@/lib/stripe';

export const runtime = 'nodejs';

function backToPro(reason: string) {
  return NextResponse.redirect(`${getBillingReturnUrl()}/pro?billing=${encodeURIComponent(reason)}`, 303);
}

export async function POST(request: Request) {
  if (!isSameOriginBillingRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  if (!process.env.STRIPE_SECRET_KEY) return backToPro('unavailable');

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
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!billing?.stripe_customer_id) return backToPro('customer-missing');

  try {
    const idempotencyKey = `cornermaximo-portal-${createHash('sha256')
      .update(`${user.id}:${Math.floor(Date.now() / 60_000)}`)
      .digest('hex')}`;
    const portal = await getStripeClient().billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: `${getBillingReturnUrl()}/pro`,
    }, {
      idempotencyKey,
    });
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error('Stripe Customer Portal Session creation failed.', {
      userId: user.id,
      error: error instanceof Error ? error.message : 'Unknown Stripe error',
    });
    return backToPro('portal-error');
  }
}
