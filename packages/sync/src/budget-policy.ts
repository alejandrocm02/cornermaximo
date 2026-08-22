export const API_FOOTBALL_CONTRACT_DAILY_LIMIT = 5_000;
export const API_FOOTBALL_MAX_USAGE_RATIO = 0.75;
export const API_FOOTBALL_SAFE_DAILY_LIMIT = Math.floor(
  API_FOOTBALL_CONTRACT_DAILY_LIMIT * API_FOOTBALL_MAX_USAGE_RATIO,
);

export function clampApiFootballDailyLimit(value: unknown): number {
  const configured = Number(value ?? API_FOOTBALL_SAFE_DAILY_LIMIT);
  if (!Number.isFinite(configured)) return API_FOOTBALL_SAFE_DAILY_LIMIT;
  return Math.min(Math.max(1, configured), API_FOOTBALL_SAFE_DAILY_LIMIT);
}
