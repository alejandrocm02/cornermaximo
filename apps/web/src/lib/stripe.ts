import 'server-only';

import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';

export const STRIPE_API_VERSION = '2026-07-29.dahlia' as const;
export const PREMIUM_DISPLAY_PRICE = '4,99 €/mes';

const PREMIUM_PRICE_ENV = 'STRIPE_PREMIUM_MONTHLY_PRICE_ID';
const INTEGRATION_PREFIX = 'cornermaximo-premium-';
const RANDOM_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

let stripeClient: Stripe | undefined;

function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('Stripe secret key is not configured.');
  return key;
}

export function getStripeClient(): Stripe {
  stripeClient ??= new Stripe(stripeSecretKey(), {
    apiVersion: STRIPE_API_VERSION,
    appInfo: {
      name: 'CornerMaximo',
      version: '0.1.0',
    },
    maxNetworkRetries: 2,
    timeout: 10_000,
    typescript: true,
  });

  return stripeClient;
}

export function getPremiumPriceId(): string | null {
  return process.env[PREMIUM_PRICE_ENV]?.trim() || null;
}

export function isPremiumPriceId(priceId: string | null | undefined): boolean {
  const configuredPriceId = getPremiumPriceId();
  return Boolean(configuredPriceId && priceId === configuredPriceId);
}

export function isManagedPaymentsEnabled(): boolean {
  return process.env.STRIPE_MANAGED_PAYMENTS_ENABLED === 'true';
}

export function isStripeBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      getPremiumPriceId() &&
      process.env.STRIPE_WEBHOOK_SECRET?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      isManagedPaymentsEnabled(),
  );
}

export function createCheckoutIntegrationIdentifier(): string {
  const bytes = randomBytes(8);
  let suffix = '';

  for (const byte of bytes) {
    suffix += RANDOM_LETTERS.charAt(byte % RANDOM_LETTERS.length);
  }

  return `${INTEGRATION_PREFIX}${suffix}`;
}
