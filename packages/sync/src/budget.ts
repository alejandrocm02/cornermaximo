/**
 * Presupuesto de requests respaldado en BD (tabla RequestBudget).
 * Doble límite: diario (plan Pro: 7 500/día, configurable vía
 * `API_FOOTBALL_DAILY_LIMIT`) y por ejecución (cada tanda de GitHub Actions
 * gasta como máximo `runLimit`).
 */
import type { PrismaClient } from '@futstats/db';
import type { RequestBudgetGuard } from '@futstats/providers';

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export class PrismaBudgetGuard implements RequestBudgetGuard {
  private runUsed = 0;

  constructor(
    private readonly db: PrismaClient,
    private readonly providerDbId: number,
    private readonly dailyLimit: number,
    private readonly runLimit: number,
  ) {}

  get usedThisRun(): number {
    return this.runUsed;
  }

  async canSpend(n: number): Promise<boolean> {
    if (this.runUsed + n > this.runLimit) return false;
    const row = await this.db.requestBudget.findUnique({
      where: { providerId_date: { providerId: this.providerDbId, date: todayUtc() } },
    });
    return (row?.used ?? 0) + n <= this.dailyLimit;
  }

  async record(n: number): Promise<void> {
    this.runUsed += n;
    await this.db.requestBudget.upsert({
      where: { providerId_date: { providerId: this.providerDbId, date: todayUtc() } },
      update: { used: { increment: n } },
      create: {
        providerId: this.providerDbId,
        date: todayUtc(),
        used: n,
        dailyLimit: this.dailyLimit,
      },
    });
  }
}
