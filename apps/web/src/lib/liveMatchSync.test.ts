import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  matchFindMany: vi.fn(),
  matchUpdate: vi.fn(),
  matchTeamUpdate: vi.fn(),
  providerGet: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@cornermaximo/db', () => ({
  prisma: {
    dataProvider: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
    match: { findMany: mocks.matchFindMany, update: mocks.matchUpdate },
    matchTeam: { update: mocks.matchTeamUpdate },
    $transaction: mocks.transaction,
  },
}));
vi.mock('@cornermaximo/providers', () => ({
  ApiFootballClient: class {
    get(...args: unknown[]) {
      return mocks.providerGet(...args);
    }
  },
  ApiFootballProvider: class {},
  mapFixture: () => ({
    status: 'FINISHED',
    kickoffAt: '2026-08-23T18:45:00.000Z',
    round: 'Regular Season - 1',
    hasExtraTime: false,
    hasPenalties: false,
    homeGoals: 2,
    awayGoals: 2,
    homePenaltyGoals: null,
    awayPenaltyGoals: null,
  }),
}));
vi.mock('@cornermaximo/sync', () => ({
  PrismaBudgetGuard: class {},
  syncMatchStats: vi.fn(),
}));

import { syncLiveScoreboard } from './liveMatchSync';

describe('syncLiveScoreboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_FOOTBALL_KEY = 'test-key';
    mocks.matchFindMany.mockResolvedValue([{ id: 4141, externalId: '1379361' }]);
    mocks.matchUpdate.mockResolvedValue({});
    mocks.matchTeamUpdate.mockResolvedValue({});
    mocks.transaction.mockResolvedValue([]);
    mocks.providerGet
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          fixture: {
            id: 1379361,
            date: '2026-08-23T18:45:00.000Z',
            status: { short: 'FT', elapsed: 90, extra: 4 },
          },
          league: { id: 61, season: 2026, round: 'Regular Season - 1' },
          teams: { home: { id: 85 }, away: { id: 94 } },
          goals: { home: 2, away: 2 },
          score: {
            extratime: { home: null, away: null },
            penalty: { home: null, away: null },
          },
        },
      ]);
  });

  it('reconciles a stale LIVE match without excluding it by kickoff age', async () => {
    const result = await syncLiveScoreboard();

    expect(mocks.matchFindMany).toHaveBeenCalledOnce();
    const query = mocks.matchFindMany.mock.calls[0]![0];
    expect(query.where).toEqual({
      providerId: 1,
      status: 'LIVE',
      externalId: { notIn: [] },
    });
    expect(query.where).not.toHaveProperty('kickoffAt');
    expect(mocks.providerGet).toHaveBeenLastCalledWith('/fixtures', { id: '1379361' });
    expect(result).toMatchObject({ live: 0, updated: 1, terminalProbes: 1 });
  });
});
