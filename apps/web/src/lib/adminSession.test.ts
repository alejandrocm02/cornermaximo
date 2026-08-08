import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncAdminSession, validSyncAdminSession, verifySyncAdminSecret } from './adminSession';

const SECRET = 's'.repeat(64);

describe('adminSession', () => {
  beforeEach(() => {
    process.env.SYNC_SECRET = SECRET;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-08T19:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.SYNC_SECRET;
  });

  it('creates a valid session that expires after four hours', () => {
    const session = createSyncAdminSession();
    expect(session).not.toBeNull();
    expect(validSyncAdminSession(session ?? undefined)).toBe(true);

    vi.setSystemTime(new Date('2026-08-08T23:01:01Z'));
    expect(validSyncAdminSession(session ?? undefined)).toBe(false);
  });

  it('rejects modified session tokens', () => {
    const session = createSyncAdminSession();
    expect(session).not.toBeNull();
    expect(validSyncAdminSession(`${session}x`)).toBe(false);
  });

  it('requires a sufficiently long sync secret', () => {
    process.env.SYNC_SECRET = 'short';
    expect(createSyncAdminSession()).toBeNull();
    expect(verifySyncAdminSecret('short')).toBe(false);
  });
});
