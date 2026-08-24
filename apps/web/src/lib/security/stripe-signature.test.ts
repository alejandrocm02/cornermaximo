import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { constructStripeEvent } from './stripe-signature';

const SECRET = 'whsec_test_secret';
const PAYLOAD = '{"id":"evt_test","type":"customer.subscription.updated"}';
const stripe = new Stripe('sk_test_unit_test', { apiVersion: '2026-07-29.dahlia' });

describe('constructStripeEvent', () => {
  const header = stripe.webhooks.generateTestHeaderString({ payload: PAYLOAD, secret: SECRET });

  it('accepts a valid Stripe signature', () => {
    expect(constructStripeEvent(PAYLOAD, header, SECRET, stripe).id).toBe('evt_test');
  });

  it('rejects tampered payloads and malformed signatures', () => {
    expect(() => constructStripeEvent(`${PAYLOAD} `, header, SECRET, stripe)).toThrow();
    expect(() => constructStripeEvent(PAYLOAD, 'invalid', SECRET, stripe)).toThrow();
  });
});
