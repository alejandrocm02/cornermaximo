import { formatSeasonLabel, WORLD_CUP_2026 } from '@futstats/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import {
  getPublicDataHealth,
  type CompetitionCoverage,
  type CompetitionCoverageLevel,
  type DataHealthLevel,
} from '@/lib/dataHealth';

export const metadata: Metadata = {
  title: 'Estado y cobertura de los datos',
  description:
    'Consulta la última sincronización y la cobertura actual de equipos, calendarios, clasificaciones, alineaciones y estadísticas de FutStats.',
  alternates: { canonical: '/estado-datos' },
};

const OVERALL_LABEL: Record<DataHealthLevel, { title: string; detail: string; className: string }> = {
  OPERATIONAL: {
    title: 'Actualización normal',
    detail: 'La sincronización reciente y las comprobaciones principales no muestran bloqueos.',
    className: 'border-pitch-accent/40 bg-pitch-accent/10 text-pitch-accent',
  },
  DEGRADED: {
    title: 'Actualización con retrasos',
    detail: 'Los datos siguen disponibles, pero alguna fuente o competición puede llegar con demora.',
    className: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  },
  ATTENTION: {
    title: 'Revisión necesaria',
    detail: 'Hay retrasos o huecos de cobertura que el sistema debe revisar.',
    className: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
  },
  UNKNOWN: {
    title: 'Estado no disponible',
    detail: 'No existe todavía una sincronización correcta con la que calcular la frescura.',
    className: 'border-pitch-border bg-pitch-card text-pitch-muted',
  },
};

const COVERAGE_LABEL: Record<CompetitionCoverageLevel, { label: string; className: string }> = {
  COMPLETE: {
    label: 'Cobertura completa',
    className: 'border-pitch-accent/40 bg-pitch-accent/10 text-pitch-accent',
  },
  READY: {
    label: 'Calendario preparado',
    className: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  },
  PARTIAL: {
    label: 'Cobertura parcial',
    className: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  },
  PENDING: {
    label: 'Pendiente de datos',
    className: 'border-pitch-border bg-pitch-elevated text-pitch-muted',
  },
  REVIEW: {
    label: 'Requiere revisión',
    className: 'border-pitch-danger/40 bg-pitch-danger/10 text-pitch-danger',
  },
};

function competitionHref(item: CompetitionCoverage): string | null {
  if (item.competition.type === 'LEAGUE') return `/ligas/${item.competition.slug}`;
  if (item.competition.slug === WORLD_CUP_2026.slug) return '/mundial-2026';
  return null;
}

function formatDate(value: string | null): string {
  if (value == null) return 'Sin actualización registrada';
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  });
}

function CoverageMeter({ value, label }: { value: number | null; label: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-2xs text-pitch-muted">
        <span>{label}</span>
        <span>{value == null ? '—' : `${value}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-pitch-elevated">
        <span
          aria-hidden="true"
          className="block h-full rounded-full bg-grad-brand transition-[width]"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

export default async function DataStatusPage() {
  const health = await getPublicDataHealth();
  const overall = OVERALL_LABEL[health.level];

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Estado de los datos' }]} />

      <section className="fs-panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-grad-brand" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="fs-eyebrow">Transparencia del dato</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Estado y cobertura de FutStats</h1>
            <p className="mt-3 text-sm leading-6 text-pitch-muted sm:text-base">
              Esta página resume cuándo se sincronizó correctamente la plataforma y qué partes de cada competición están disponibles. Un porcentaje inferior al 100 % no implica necesariamente un error: los próximos partidos aún no tienen alineaciones ni estadísticas.
            </p>
          </div>
          <div className={`max-w-sm rounded-xl border px-4 py-3 ${overall.className}`}>
            <p className="font-semibold">{overall.title}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{overall.detail}</p>
          </div>
        </div>
      </section>

      <section aria-label="Resumen de sincronización" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Última sincronización correcta"
          value={health.lastSuccessfulSync == null ? 'Sin datos' : formatDate(health.lastSuccessfulSync)}
          detail={
            health.hoursSinceSuccessfulSync == null
              ? 'No se puede calcular la antigüedad.'
              : `Hace ${health.hoursSinceSuccessfulSync} h`
          }
        />
        <SummaryCard
          label="Competiciones vigentes"
          value={String(health.totals.competitions)}
          detail={`${health.totals.teams} afiliaciones de equipos`}
        />
        <SummaryCard
          label="Partidos registrados"
          value={health.totals.matches.toLocaleString('es-ES')}
          detail={`${health.totals.finishedMatches} finalizados · ${health.totals.scheduledMatches} programados`}
        />
        <SummaryCard
          label="Elementos a revisar"
          value={String(
            health.totals.pastDueMatches +
              health.totals.finishedWithoutLineups +
              health.totals.competitionsNeedingReview,
          )}
          detail={`${health.totals.pastDueMatches} partidos vencidos · ${health.totals.finishedWithoutLineups} sin acta`}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fs-eyebrow">Cobertura vigente</p>
            <h2 className="mt-1 text-2xl font-bold">Competición por competición</h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-pitch-muted">
            Las alineaciones comparan partidos finalizados con actas disponibles. Las estadísticas comparan jugadores incluidos en actas con registros estadísticos recibidos.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {health.competitions.map((item) => {
            const coverage = COVERAGE_LABEL[item.level];
            const href = competitionHref(item);
            const logoUrl =
              item.competition.logoUrl ??
              `https://media.api-sports.io/football/leagues/${item.competition.externalId}.png`;

            return (
              <article key={item.seasonId} className="fs-panel p-5">
                <div className="flex items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    width={52}
                    height={52}
                    alt=""
                    loading="lazy"
                    className="h-13 w-13 rounded-xl bg-white p-1.5 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        {href == null ? (
                          <h3 className="truncate font-display text-lg font-semibold">{item.competition.name}</h3>
                        ) : (
                          <h3 className="truncate font-display text-lg font-semibold">
                            <Link href={href} className="hover:text-pitch-accent">
                              {item.competition.name}
                            </Link>
                          </h3>
                        )}
                        <p className="text-xs text-pitch-muted">
                          {item.competition.country} ·{' '}
                          {formatSeasonLabel(item.year, item.competition.seasonFormat)}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-2xs font-semibold ${coverage.className}`}>
                        {coverage.label}
                      </span>
                    </div>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <MiniStat label="Equipos" value={item.teamCount} />
                  <MiniStat label="Partidos" value={item.totalMatches} />
                  <MiniStat label="Finalizados" value={item.finishedMatches} />
                  <MiniStat label="Programados" value={item.scheduledMatches} />
                </dl>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <CoverageMeter value={item.lineupCoverage} label="Actas de finalizados" />
                  <CoverageMeter value={item.statisticsCoverage} label="Estadísticas en actas" />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-pitch-border/70 pt-3 text-2xs text-pitch-muted">
                  <span>Último cambio: {formatDate(item.lastDataAt)}</span>
                  {(item.pastDueMatches > 0 || item.finishedWithoutLineups > 0) && (
                    <span className="text-pitch-danger">
                      {item.pastDueMatches > 0 ? `${item.pastDueMatches} vencidos` : ''}
                      {item.pastDueMatches > 0 && item.finishedWithoutLineups > 0 ? ' · ' : ''}
                      {item.finishedWithoutLineups > 0 ? `${item.finishedWithoutLineups} sin acta` : ''}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-pitch-border bg-pitch-card/50 p-5 text-sm text-pitch-muted">
        <h2 className="font-semibold text-white">Cómo interpretar estos datos</h2>
        <p className="mt-2 leading-6">
          FutStats no inventa valores ausentes. Cuando el proveedor todavía no ha publicado una clasificación, un acta o una estadística, la cobertura aparece como parcial o pendiente. Consulta la{' '}
          <Link href="/metodologia" className="text-pitch-accent hover:underline">
            metodología
          </Link>{' '}
          para conocer el tratamiento de valores no disponibles y las fuentes utilizadas.
        </p>
        <p className="mt-2 text-2xs">
          Estado calculado el {formatDate(health.generatedAt)} y renovado automáticamente después de cada sincronización o cada quince minutos.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="fs-panel p-4">
      <p className="text-2xs font-semibold uppercase tracking-wide text-pitch-muted">{label}</p>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-pitch-muted">{detail}</p>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-pitch-border/70 bg-pitch-bg/40 px-3 py-2">
      <dt className="text-2xs text-pitch-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold">{value.toLocaleString('es-ES')}</dd>
    </div>
  );
}
