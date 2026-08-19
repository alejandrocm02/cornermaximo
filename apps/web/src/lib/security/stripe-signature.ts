import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const item of header.split(',')) {
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key === 't') timestamp = value;
    if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return signatures.some((signature) => {
    const provided = Buffer.from(signature, 'utf8');
    return provided.length === expectedBuffer.length && timingSafeEqual(provided, expectedBuffer);
  });
}
