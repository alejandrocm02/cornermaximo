import 'server-only';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';
const STRIPE_API_VERSION = '2026-06-24.dahlia';
const STRIPE_TIMEOUT_MS = 10_000;

interface StripeErrorEnvelope {
  error?: { message?: string };
}

function getSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe secret key is not configured.');
  return key;
}

async function parseStripeResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & StripeErrorEnvelope;
  if (!response.ok) {
    throw new Error(body.error?.message || `Stripe API error (${response.status}).`);
  }
  return body;
}

export async function stripePost<T>(
  path: string,
  params: URLSearchParams,
  options: { idempotencyKey: string },
): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': STRIPE_API_VERSION,
      'Idempotency-Key': options.idempotencyKey,
    },
    body: params.toString(),
    cache: 'no-store',
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  });
  return parseStripeResponse<T>(response);
}

export async function stripeGet<T>(path: string): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Stripe-Version': STRIPE_API_VERSION,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(STRIPE_TIMEOUT_MS),
  });
  return parseStripeResponse<T>(response);
}
