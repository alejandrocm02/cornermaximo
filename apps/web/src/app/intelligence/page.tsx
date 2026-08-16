import Link from 'next/link';
import { getCurrentEntitlement } from '@/lib/entitlements';
import {
  getIntelligenceSnapshot,
  type EntityIntelligenceSignal,
} from '@/lib/intelligenceData';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'CM Intelligence | Tendencias de fútbol | CornerMaximo',
  description:
    'Detecta tendencias históricas de equipos y jugadores con muestras verificables, frecuencia observada y CM Confidence.',
  alternates: { canonical: '/intelligence' },
};

const FREE_PREVIEW = 4;
const PRO_LIMIT = 60;

type EntityType = 'TEAM' | 'PLAYER';

function parseType(value?: string): EntityType {
  return value === 'PLAYER' ? 'PLAYER' : 'TEAM';
}

function parsePercent(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return [60, 70, 80, 90].includes(parsed) ? parsed : 70;
}

function parseSample(value?: string): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return [5, 8, 10].includes(parsed) ? parsed : 5;
}

function percentage(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function filterSignals(
  signals: EntityIntelligenceSignal[],
  minPercent: number,
  minSample: number,
): EntityIntelligenceSignal[] {
  return signals.filter(
    (signal) => signal.hitRate * 100 >= minPercent && signal.sampleSize >= minSample,
  );
}

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; porcentaje?: string; muestra?: string }>;
}) {
  const params = await searchParams;
  const entityType = parseType(params.tipo);
  const minPercent = parsePercent(params.porcentaje);
  const minSample = parseSample(params.muestra);
  const [snapshot, entitlement] = await Promise.all([
    getIntelligenceSnapshot(),
    getCurrentEntitlement(),
  ]);

  const source = entityType === 'PLAYER' ? snapshot.playerSignals : snapshot.teamSignals;
  const filtered = filterSignals(source, minPercent, minSample);
  const visible = filtered.slice(0, entitlement.isPro ? PRO_LIMIT : FREE_PREVIEW);
  const lockedCount = entitlement.isPro ? Math.max(filtered.length - PRO_LIMIT, 0) : Math.max(filtered.length - FREE_PREVIEW, 0);

  return (
    <div className="space-y-6">
      <header className="fs-panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="absolute right-0 top-0 h-64 w-80 bg-pitch-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="fs-eyebrow">CORNERMAXIMO · CM INTELLIGENCE</p>
              <span className={`fs-chip ${entitlement.isPro ? 'border-pitch-accent/40 text-pitch-accent' : ''}`}>
                {entitlement.isPro ? 'PRO ACTIVO' : 'FREE'}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Tendencias que puedes verificar</h1>
            <p className="mt-3 text-sm leading-6 text-pitch-muted sm:text-base">
              CornerMaximo examina ventanas recientes de partidos y destaca patrones repetidos sin rellenar datos ausentes ni presentar una frecuencia histórica como certeza futura.
            </p>
          </div>
          {!entitlement.isPro && (
            <Link href={entitlement.isAuthenticated ? '/pro' : '/auth/login?next=/intelligence'} className="fs-btn-primary shrink-0">
              {entitlement.isAuthenticated ? 'Desbloquear CornerMaximo Pro' : 'Entrar para desbloquear Pro'}
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Señales de equipos" value={snapshot.teamSignals.length.toString()} detail="Patrones con muestra suficiente" />
        <SummaryCard label="Señales de jugadores" value={snapshot.playerSignals.length.toString()} detail="Solo métricas disponibles" />
        <SummaryCard label="Actualización" value="Automática" detail="Sincronizada con la base deportiva" />
      </section>

      <form method="GET" action="/intelligence" className="fs-panel grid gap-4 p-4 sm:grid-cols-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Analizar</span>
          <select name="tipo" defaultValue={entityType} className="h-11 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 text-white">
            <option value="TEAM">Equipos</option>
            <option value="PLAYER">Jugadores</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Frecuencia mínima</span>
          <select name="porcentaje" defaultValue={minPercent} className="h-11 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 text-white">
            <option value="60">60%</option>
            <option value="70">70%</option>
            <option value="80">80%</option>
            <option value="90">90%</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Muestra mínima</span>
          <select name="muestra" defaultValue={minSample} className="h-11 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 text-white">
            <option value="5">5 partidos</option>
            <option value="8">8 partidos</option>
            <option value="10">10 partidos</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="fs-btn-primary min-h-11 w-full justify-center">Aplicar filtros</button>
        </div>
      </form>

      <section className="space-y-3" aria-labelledby="signals-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fs-eyebrow">LIVE DATASET · L10</p>
            <h2 id="signals-heading" className="mt-1 text-2xl font-bold">
              {entityType === 'TEAM' ? 'Tendencias de equipos' : 'Tendencias de jugadores'}
            </h2>
          </div>
          <p className="text-xs text-pitch-muted">{filtered.length} patrones cumplen los filtros</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((signal) => (
            <SignalCard key={`${signal.entityType}-${signal.entityId}-${signal.key}`} signal={signal} />
          ))}
        </div>

        {visible.length === 0 && (
          <div className="fs-panel p-10 text-center">
            <p className="font-semibold">No hay patrones con esta exigencia</p>
            <p className="mt-2 text-sm text-pitch-muted">Reduce el porcentaje o la muestra mínima para ampliar resultados.</p>
          </div>
        )}

        {!entitlement.isPro && lockedCount > 0 && (
          <div className="fs-panel relative overflow-hidden border-pitch-accent/30 p-6 sm:p-8">
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-pitch-accent/10 via-transparent to-transparent" />
            <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="fs-eyebrow">CORNERMAXIMO PRO</p>
                <h3 className="mt-2 text-2xl font-bold">🔒 {lockedCount} señales adicionales</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-pitch-muted">
                  El plan Pro desbloqueará el listado completo, filtros avanzados, ventanas históricas mayores, búsquedas guardadas y alertas sobre condiciones estadísticas.
                </p>
              </div>
              <Link href={entitlement.isAuthenticated ? '/pro' : '/auth/login?next=/intelligence'} className="fs-btn-primary justify-center">
                Ver CornerMaximo Pro
              </Link>
            </div>
          </div>
        )}
      </section>

      <aside className="rounded-xl border border-pitch-border bg-pitch-elevated/50 p-4 text-xs leading-5 text-pitch-muted">
        <strong className="text-pitch-subtle">Cómo interpretar CM Confidence:</strong> es un índice de consistencia histórica que combina frecuencia observada y tamaño de muestra. No es una probabilidad futura, una predicción garantizada ni una recomendación de apuesta. Las métricas no disponibles en el proveedor se excluyen de la muestra en lugar de tratarse como cero.
      </aside>
    </div>
  );
}

function SignalCard({ signal }: { signal: EntityIntelligenceSignal }) {
  return (
    <article className="fs-panel-interactive p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pitch-muted">{signal.entityType === 'TEAM' ? 'EQUIPO' : 'JUGADOR'} · {signal.kind}</p>
          <Link href={signal.entityHref} className="mt-1 block truncate font-semibold text-white hover:text-pitch-accent">
            {signal.entityName}
          </Link>
          <p className="truncate text-xs text-pitch-muted">{signal.context ?? 'CornerMaximo data'}</p>
        </div>
        <div className="rounded-lg border border-pitch-accent/30 bg-pitch-accent/10 px-2.5 py-2 text-center">
          <p className="font-display text-xl font-bold tabular-nums text-pitch-accent">{signal.consistencyScore}</p>
          <p className="text-[9px] uppercase tracking-wide text-pitch-muted">CM Confidence</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-pitch-elevated p-3">
        <p className="font-semibold text-white">{signal.label}</p>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span className="text-pitch-muted">Cumplimiento L{signal.sampleSize}</span>
          <strong className="tabular-nums text-white">{signal.hits}/{signal.sampleSize} · {percentage(signal.hitRate)}</strong>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pitch-bg">
          <div className="h-full rounded-full bg-pitch-accent" style={{ width: `${Math.round(signal.hitRate * 100)}%` }} />
        </div>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="fs-panel p-4">
      <p className="text-xs text-pitch-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-pitch-muted">{detail}</p>
    </div>
  );
}
