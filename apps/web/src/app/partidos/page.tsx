import type { Metadata } from 'next';
import Link from 'next/link';
import { MatchCard } from '@/components/MatchCard';
import { adjacentMadridDate, getMatchCenterPage } from '@/lib/matchCenterPage';
import {
  getMatchFilters,
  isValidMatchDate,
  todayInMadrid,
  type MatchCenterView,
  type MatchListItem,
} from '@/lib/matches';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partidos de fútbol: calendario y resultados',
  description:
    'Consulta partidos de hoy, próximos encuentros y resultados recientes con filtros por fecha, competición y equipo.',
  alternates: { canonical: '/partidos' },
};

const VIEW_LABEL: Record<MatchCenterView, string> = {
  today: 'Hoy',
  upcoming: 'Próximos',
  recent: 'Resultados',
};

function normalizeView(value: string | undefined): MatchCenterView {
  if (value === 'upcoming' || value === 'recent') return value;
  return 'today';
}

function normalizePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildHref(values: {
  view: MatchCenterView;
  competitionSlug?: string;
  teamSlug?: string;
  date?: string;
  page?: number;
}): string {
  const params = new URLSearchParams({ vista: values.view });
  if (values.competitionSlug != null) params.set('liga', values.competitionSlug);
  if (values.teamSlug != null) params.set('equipo', values.teamSlug);
  if (values.date != null) params.set('fecha', values.date);
  if (values.page != null && values.page > 1) params.set('pagina', String(values.page));
  return `/partidos?${params.toString()}`;
}

function madridDayKey(value: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function dayHeading(value: string, today: string): string {
  if (value === today) return 'Hoy';
  const date = new Date(`${value}T12:00:00Z`);
  return date.toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupMatches(matches: MatchListItem[]): Array<{ date: string; matches: MatchListItem[] }> {
  const groups = new Map<string, MatchListItem[]>();
  for (const match of matches) {
    const key = madridDayKey(match.kickoffAt);
    const group = groups.get(key) ?? [];
    group.push(match);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([date, groupedMatches]) => ({ date, matches: groupedMatches }));
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; liga?: string; equipo?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const view = normalizeView(params.vista);
  const today = todayInMadrid();
  const explicitDate = isValidMatchDate(params.fecha) ? params.fecha : undefined;
  const selectedDate = explicitDate ?? (view === 'today' ? today : undefined);
  const competitionSlug = params.liga?.trim() || undefined;
  const teamSlug = params.equipo?.trim() || undefined;
  const requestedPage = normalizePage(params.pagina);

  const [result, filters] = await Promise.all([
    getMatchCenterPage({ view, date: selectedDate, competitionSlug, teamSlug, page: requestedPage }),
    getMatchFilters(),
  ]);

  const matches = result.matches;
  const grouped = groupMatches(matches);
  const liveCount = matches.filter((match) => match.status === 'LIVE').length;
  const finishedCount = matches.filter((match) => match.status === 'FINISHED').length;
  const scheduledCount = matches.filter((match) => match.status === 'SCHEDULED').length;
  const selectedCompetition = filters.competitions.find((competition) => competition.slug === competitionSlug);
  const selectedTeam = filters.teams.find((team) => team.slug === teamSlug);
  const previousDate = selectedDate != null ? adjacentMadridDate(selectedDate, -1) : null;
  const nextDate = selectedDate != null ? adjacentMadridDate(selectedDate, 1) : null;

  return (
    <div className="space-y-8">
      <header className="fs-panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(48,229,157,0.12),transparent_40%)]" />
        <div className="relative max-w-3xl">
          <p className="fs-eyebrow">Centro de competición</p>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Partidos, calendario y resultados</h1>
          <p className="mt-3 text-sm leading-6 text-pitch-muted sm:text-base">
            Sigue los encuentros sincronizados de las competiciones activas. Las fechas concretas se muestran completas; las vistas de 30 días están paginadas para mantener una carga rápida.
          </p>
          <div className="mt-5 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
            <Summary label={result.isCompleteDay ? 'Partidos del día' : 'Total encontrados'} value={result.total} />
            <Summary label="En esta página" value={matches.length} />
            <Summary label="Finalizados" value={finishedCount} />
            <Summary label="Programados" value={scheduledCount + liveCount} />
          </div>
        </div>
      </header>

      <section aria-labelledby="explorar-partidos" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fs-eyebrow">Explorar</p>
            <h2 id="explorar-partidos" className="mt-2 text-2xl font-bold">Centro de partidos</h2>
          </div>
          {(selectedCompetition != null || selectedTeam != null || explicitDate != null) && (
            <Link href="/partidos" className="fs-btn-ghost text-xs">Limpiar filtros</Link>
          )}
        </div>

        <nav aria-label="Vistas del calendario" className="grid grid-cols-3 gap-2 sm:flex">
          {(['today', 'upcoming', 'recent'] as const).map((item) => {
            const active = view === item && explicitDate == null;
            return (
              <Link
                key={item}
                href={buildHref({ view: item, competitionSlug, teamSlug })}
                aria-current={active ? 'page' : undefined}
                className={`rounded-xl border px-4 py-2.5 text-center text-sm font-semibold transition ${
                  active
                    ? 'border-pitch-accent bg-pitch-accent/10 text-pitch-accent shadow-glow-soft'
                    : 'border-pitch-border bg-pitch-card text-pitch-muted hover:border-pitch-border-strong hover:text-white'
                }`}
              >
                {VIEW_LABEL[item]}
              </Link>
            );
          })}
        </nav>

        <form method="get" className="fs-panel grid gap-3 p-4 md:grid-cols-[0.8fr_1fr_1fr_auto] md:items-end">
          <input type="hidden" name="vista" value={view} />
          <label className="grid gap-1.5 text-xs font-medium text-pitch-subtle">
            Fecha
            <input
              type="date"
              name="fecha"
              defaultValue={selectedDate}
              className="h-11 rounded-lg border border-pitch-border bg-pitch-elevated px-3 text-sm text-white outline-none transition focus:border-pitch-accent"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-pitch-subtle">
            Competición
            <select
              name="liga"
              defaultValue={competitionSlug ?? ''}
              className="h-11 rounded-lg border border-pitch-border bg-pitch-elevated px-3 text-sm text-white outline-none transition focus:border-pitch-accent"
            >
              <option value="">Todas las competiciones</option>
              {filters.competitions.map((competition) => (
                <option key={competition.slug} value={competition.slug}>{competition.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-pitch-subtle">
            Equipo
            <select
              name="equipo"
              defaultValue={teamSlug ?? ''}
              className="h-11 rounded-lg border border-pitch-border bg-pitch-elevated px-3 text-sm text-white outline-none transition focus:border-pitch-accent"
            >
              <option value="">Todos los equipos</option>
              {filters.teams.map((team) => (
                <option key={team.slug} value={team.slug}>{team.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="fs-btn-primary h-11 px-5">Aplicar</button>
        </form>

        {selectedDate != null && previousDate != null && nextDate != null && (
          <nav aria-label="Cambiar día" className="grid grid-cols-3 items-center gap-2">
            <Link href={buildHref({ view, competitionSlug, teamSlug, date: previousDate })} className="fs-btn-ghost justify-center text-xs">
              ← Día anterior
            </Link>
            <Link href={buildHref({ view: 'today', competitionSlug, teamSlug, date: today })} className="text-center text-xs font-semibold text-pitch-accent hover:text-white">
              Ir a hoy
            </Link>
            <Link href={buildHref({ view, competitionSlug, teamSlug, date: nextDate })} className="fs-btn-ghost justify-center text-xs">
              Día siguiente →
            </Link>
          </nav>
        )}

        {(selectedCompetition != null || selectedTeam != null) && (
          <p className="text-xs text-pitch-muted">
            Mostrando {selectedCompetition?.name ?? 'todas las competiciones'}
            {selectedTeam != null ? ` · ${selectedTeam.name}` : ''}.
          </p>
        )}
      </section>

      {grouped.length > 0 ? (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.date} aria-labelledby={`fecha-${group.date}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id={`fecha-${group.date}`} className="font-display text-lg font-semibold capitalize text-white">
                  {dayHeading(group.date, today)}
                </h2>
                <span className="fs-chip">{group.matches.length} {group.matches.length === 1 ? 'partido' : 'partidos'}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.matches.map((match) => <MatchCard key={match.id} match={match} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="fs-panel px-5 py-12 text-center">
          <p className="font-display text-lg font-semibold text-white">No hay partidos para estos filtros</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-pitch-muted">
            Puede que el calendario todavía no esté publicado, que la fecha no tenga encuentros o que la combinación de liga y equipo no corresponda a la temporada vigente.
          </p>
          <Link href="/partidos" className="fs-btn-primary mt-5 inline-flex">Volver a hoy</Link>
        </section>
      )}

      {result.totalPages > 1 && (
        <nav aria-label="Paginación de partidos" className="fs-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-xs text-pitch-muted">
            Página {result.page} de {result.totalPages} · {result.total} partidos en total
          </p>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Link href={buildHref({ view, competitionSlug, teamSlug, page: result.page - 1 })} className="fs-btn-ghost text-xs">
                ← Anterior
              </Link>
            )}
            {result.page < result.totalPages && (
              <Link href={buildHref({ view, competitionSlug, teamSlug, page: result.page + 1 })} className="fs-btn-primary text-xs">
                Siguiente →
              </Link>
            )}
          </div>
        </nav>
      )}

      {selectedDate != null && (
        <p className="text-center text-2xs text-pitch-muted">
          La fecha seleccionada se consulta sin límite de resultados. Solo pueden faltar encuentros que todavía no estén sincronizados en FutStats.
        </p>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-pitch-border bg-pitch-elevated/70 px-3 py-3">
      <p className="font-display text-xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-0.5 text-2xs uppercase tracking-wide text-pitch-muted">{label}</p>
    </div>
  );
}
