import { describe, expect, it } from 'vitest';
import { isSameOriginBillingRequest } from './billing-request';

describe('isSameOriginBillingRequest', () => {
  it('accepts a same-origin billing form post', () => {
    const request = new Request('https://cornermaximo.test/api/billing/checkout', {
      method: 'POST',
      headers: { origin: 'https://cornermaximo.test' },
    });

    expect(isSameOriginBillingRequest(request)).toBe(true);
  });

  it('accepts the trusted forwarded host and protocol used by Vercel', () => {
    const request = new Request('http://internal/api/billing/portal', {
      method: 'POST',
      headers: {
        origin: 'https://preview.cornermaximo.test',
        'x-forwarded-host': 'preview.cornermaximo.test',
        'x-forwarded-proto': 'https',
      },
    });

    expect(isSameOriginBillingRequest(request)).toBe(true);
  });

  it('rejects cross-origin and originless requests', () => {
    const crossOrigin = new Request('https://cornermaximo.test/api/billing/checkout', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    const originless = new Request('https://cornermaximo.test/api/billing/checkout', {
      method: 'POST',
    });

    expect(isSameOriginBillingRequest(crossOrigin)).toBe(false);
    expect(isSameOriginBillingRequest(originless)).toBe(false);
  });
});
