import { prisma } from '@futstats/db';
import { CURRENT_SEASON, TRACKED_SEASONS } from '@futstats/shared';
import Link from 'next/link';
import { seasonLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rankings' };

const METRICS = [
  { value: 'goals', label: 'Goles' },
  { value: 'assists', label: 'Asistencias' },
  { value: 'keyPasses', label: 'Pases clave' },
  { value: 'shotsOnTarget', label: 'Tiros a puerta' },
  { value: 'tacklesWon', label: 'Entradas ganadas' },
  { value: 'interceptions', label: 'Intercepciones' },
  { value: 'saves', label: 'Paradas (porteros)' },
] as const;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string; league?: string; season?: string }>;
}) {
  const { metric: metricParam, league, season: seasonParam } = await searchParams;
  const metric = METRICS.some((m) => m.value === metricParam) ? metricParam! : 'goals';
  const parsedSeason = Number(seasonParam ?? CURRENT_SEASON);
  const season = TRACKED_SEASONS.some((value) => value === parsedSeason) ? parsedSeason : CURRENT_SEASON;

  const leagues = await prisma.competition.findMany({ orderBy: { name: 'asc' } });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL != null ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  let rows: Array<{ rank: number; slug: string; name: string; team: string | null; total: number; minutes: number }> = [];
  try {
    const res = await fetch(
      `${base}/api/rankings?metric=${metric}&season=${season}${league != null && league !== '' ? `&league=${league}` : ''}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const data = (await res.json()) as { results: typeof rows };
      rows = data.results;
    }
  } catch {
    // Base de datos vacia o app arrancando: se muestra el estado vacio.
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rankings</h1>

      <form method="GET" className="flex flex-wrap gap-3 text-sm">
        <select name="metric" defaultValue={metric} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          {METRICS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select name="league" defaultValue={league ?? ''} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          <option value="">Todas las competiciones</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.slug}>{l.name}</option>
          ))}
        </select>
        <select name="season" defaultValue={season} className="rounded-lg border border-pitch-border bg-pitch-card px-3 py-2">
          {TRACKED_SEASONS.map((value) => (
            <option key={value} value={value}>{seasonLabel(value)}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">Ver</button>
      </form>

      <div className="overflow-hidden rounded-lg border border-pitch-border">
        <table className="w-full bg-pitch-card text-sm">
          <thead className="text-left text-xs uppercase text-pitch-muted">
            <tr className="border-b border-pitch-border">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Jugador</th>
              <th className="px-4 py-2">Equipo</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Minutos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-b border-pitch-border/50 last:border-0">
                <td className="px-4 py-2 text-pitch-muted">{r.rank}</td>
                <td className="px-4 py-2">
                  <Link href={`/jugadores/${r.slug}`} className="hover:text-pitch-accent">{r.name}</Link>
                </td>
                <td className="px-4 py-2 text-pitch-muted">{r.team ?? '-'}</td>
                <td className="px-4 py-2 text-right font-semibold">{r.total}</td>
                <td className="px-4 py-2 text-right text-pitch-muted">{r.minutes}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-pitch-muted">
                  Sin datos todavia. Los rankings aparecen tras sincronizar estadisticas de partidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
