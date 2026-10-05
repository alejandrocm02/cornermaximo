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

  it('allows news thumbnails only from the aggregated outlets', () => {
    const imgSrc = createContentSecurityPolicy('test-nonce', false)
      .split('; ')
      .find((directive) => directive.startsWith('img-src'))!;

    for (const host of [
      'https://objetos.estaticos-marca.com',
      'https://img.asmedia.epimg.net',
      'https://vdmedia.as.com',
      'https://ichef.bbci.co.uk',
      'https://*.365dm.com',
    ]) {
      expect(imgSrc.split(' ')).toContain(host);
    }
    // Sigue siendo una lista cerrada: nada de comodines globales.
    expect(imgSrc.split(' ')).not.toContain('https:');
    expect(imgSrc.split(' ')).not.toContain('*');
  });

  it('allows eval only for the Next.js development runtime', () => {
    const policy = createContentSecurityPolicy('dev-nonce', true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
});
