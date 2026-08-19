import { describe, expect, it } from 'vitest';
import { createContentSecurityPolicy } from './csp';

describe('createContentSecurityPolicy', () => {
  it('uses a request nonce and forbids high-risk embedding directives', () => {
    const policy = createContentSecurityPolicy('test-nonce', false);

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain('upgrade-insecure-requests');
  });

  it('allows eval only for the Next.js development runtime', () => {
    const policy = createContentSecurityPolicy('dev-nonce', true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});
