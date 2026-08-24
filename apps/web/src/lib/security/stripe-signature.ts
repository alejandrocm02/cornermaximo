import type Stripe from 'stripe';

export function constructStripeEvent(
  payload: string,
  signature: string,
  secret: string,
  stripe: Stripe,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
