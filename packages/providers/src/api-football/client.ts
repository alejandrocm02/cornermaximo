/**
 * Cliente HTTP de API-Football (v3.football.api-sports.io).
 * - Comprueba el presupuesto ANTES de cada request (plan gratuito: 100/día).
 * - Reintenta errores transitorios (429/5xx) con backoff exponencial.
 * - La clave de API vive SOLO en el servidor.
 */
import {
  BudgetExceededError,
  ProviderHttpError,
  type RequestBudgetGuard,
} from '../FootballDataProvider';

export interface ApiFootballConfig {
  apiKey: string;
  baseUrl: string; // https://v3.football.api-sports.io
  budget: RequestBudgetGuard;
  maxRetries?: number;
  /** Separación mínima entre requests (plan gratuito: 10/min => ~6.5s). */
  minIntervalMs?: number;
  /** Inyectable para tests. */
  fetchFn?: typeof fetch;
  /** Inyectable para tests (sin esperas reales). */
  sleepFn?: (ms: number) => Promise<void>;
}

interface ApiFootballEnvelope<T> {
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ApiFootballClient {
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly minIntervalMs: number;
  private lastRequestAt = 0;

  constructor(private readonly config: ApiFootballConfig) {
    this.maxRetries = config.maxRetries ?? 3;
    this.fetchFn = config.fetchFn ?? fetch;
    this.sleepFn = config.sleepFn ?? defaultSleep;
    this.minIntervalMs = config.minIntervalMs ?? 6_500;
  }

  /**
   * GET con paginación automática. Cada página consume 1 request del presupuesto.
   */
  async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const envelope = await this.getPage<T>(path, { ...params, ...(totalPages > 1 || page > 1 ? { page } : {}) });
      all.push(...envelope.response);
      totalPages = envelope.paging?.total ?? 1;
      page++;
    } while (page <= totalPages);

    return all;
  }

  private async getPage<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<ApiFootballEnvelope<T>> {
    if (!(await this.config.budget.canSpend(1))) {
      throw new BudgetExceededError();
    }

    const url = new URL(path, this.config.baseUrl);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, String(v));
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // 429 => esperar más que el minuto de la ventana de rate limit
        await this.sleepFn(attempt === 1 ? 7_000 : 15_000 * (attempt - 1));
      }

      // Ritmo del plan gratuito: 10 requests/minuto
      const sinceLast = Date.now() - this.lastRequestAt;
      if (sinceLast < this.minIntervalMs) {
        await this.sleepFn(this.minIntervalMs - sinceLast);
      }
      this.lastRequestAt = Date.now();

      const res = await this.fetchFn(url.toString(), {
        headers: { 'x-apisports-key': this.config.apiKey },
      });
      await this.config.budget.record(1);

      if (res.ok) {
        const body = (await res.json()) as ApiFootballEnvelope<T>;
        // API-Football devuelve 200 con `errors` poblado en fallos lógicos.
        if (body.errors && Object.keys(body.errors as object).length > 0) {
          throw new ProviderHttpError(200, url.toString(), JSON.stringify(body.errors));
        }
        return body;
      }

      lastError = new ProviderHttpError(res.status, url.toString());
      const transient = res.status === 429 || res.status >= 500;
      if (!transient) throw lastError;
    }

    throw lastError ?? new ProviderHttpError(0, url.toString(), 'Reintentos agotados');
  }
}
