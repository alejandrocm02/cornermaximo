import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyStripeSignature } from './stripe-signature';

const NOW = new Date('2026-08-19T12:00:00Z');
const SECRET = 'whsec_test_secret';
const PAYLOAD = '{"id":"evt_test"}';

function headerFor(timestamp: number, secret = SECRET): string {
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${PAYLOAD}`, 'utf8')
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('verifyStripeSignature', () => {
  afterEach(() => vi.useRealTimers());

  it('accepts a current valid signature and rejects tampering', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const timestamp = Math.floor(NOW.getTime() / 1000);

    expect(verifyStripeSignature(PAYLOAD, headerFor(timestamp), SECRET)).toBe(true);
    expect(verifyStripeSignature(`${PAYLOAD} `, headerFor(timestamp), SECRET)).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, headerFor(timestamp), 'another-secret')).toBe(false);
  });

  it('rejects malformed and replayed signatures outside the tolerance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const oldTimestamp = Math.floor(NOW.getTime() / 1000) - 301;

    expect(verifyStripeSignature(PAYLOAD, headerFor(oldTimestamp), SECRET)).toBe(false);
    expect(verifyStripeSignature(PAYLOAD, 'invalid', SECRET)).toBe(false);
  });
});
