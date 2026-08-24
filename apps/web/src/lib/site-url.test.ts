import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBillingReturnUrl } from './site-url';

describe('getBillingReturnUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns to the current Vercel preview deployment', () => {
    vi.stubEnv('VERCEL_TARGET_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'cornermaximo-preview.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cornermaximo.example');

    expect(getBillingReturnUrl()).toBe('https://cornermaximo-preview.vercel.app');
  });

  it('uses the stable production hostname in production', () => {
    vi.stubEnv('VERCEL_TARGET_ENV', 'production');
    vi.stubEnv('VERCEL_URL', 'cornermaximo-deployment.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cornermaximo.example');

    expect(getBillingReturnUrl()).toBe('https://cornermaximo.example');
  });
});
