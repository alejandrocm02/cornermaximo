/**
 * Presupuesto de requests respaldado en BD (tabla RequestBudget).
 * El límite efectivo se recorta a la política segura global de API-Football
 * (75% de 5.000 requests/día = 3.750), además del límite por ejecución.
 */
import type { PrismaClient } from '@cornermaximo/db';
import type { RequestBudgetGuard } from '@cornermaximo/providers';
import { clampApiFootballDailyLimit } from './budget-policy';

function todayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export class PrismaBudgetGuard implements RequestBudgetGuard {
  private runUsed = 0;
  private readonly effectiveDailyLimit: number;

  constructor(
    private readonly db: PrismaClient,
    private readonly providerDbId: number,
    dailyLimit: number,
    private readonly runLimit: number,
  ) {
    this.effectiveDailyLimit = clampApiFootballDailyLimit(dailyLimit);
  }

  get usedThisRun(): number {
    return this.runUsed;
  }

  async canSpend(n: number): Promise<boolean> {
    if (this.runUsed + n > this.runLimit) return false;
    const row = await this.db.requestBudget.findUnique({
      where: { providerId_date: { providerId: this.providerDbId, date: todayUtc() } },
    });
    return (row?.used ?? 0) + n <= this.effectiveDailyLimit;
  }

  async record(n: number): Promise<void> {
    this.runUsed += n;
    await this.db.requestBudget.upsert({
      where: { providerId_date: { providerId: this.providerDbId, date: todayUtc() } },
      update: { used: { increment: n }, dailyLimit: this.effectiveDailyLimit },
      create: {
        providerId: this.providerDbId,
        date: todayUtc(),
        used: n,
        dailyLimit: this.effectiveDailyLimit,
      },
    });
  }
}
