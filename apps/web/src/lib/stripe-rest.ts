import 'server-only';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

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

export async function stripePost<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  });
  return parseStripeResponse<T>(response);
}

export async function stripeGet<T>(path: string): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${getSecretKey()}` },
    cache: 'no-store',
  });
  return parseStripeResponse<T>(response);
}
