import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getCheckoutIntegrationIdentifier } from './stripe';

describe('getCheckoutIntegrationIdentifier', () => {
  it('keeps the checkout label stable for idempotent retries', () => {
    const identifier = getCheckoutIntegrationIdentifier();

    expect(getCheckoutIntegrationIdentifier()).toBe(identifier);
    expect(identifier).toMatch(/^cornermaximo-premium-[a-z]{8}$/);
  });
});
