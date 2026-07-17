import { prisma } from '@futstats/db';
import { WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { topPlayerStat } from '@/lib/worldCupStats';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mundial 2026' };

function formatKickoff(d: Date) {
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default async function WorldCupPage() {
  const competition = await prisma.competition.findUnique({
    where: { slug: WORLD_CUP_2026.slug },
    include: {
      seasons: {
        include: {
          standings: {
            include: { team: { select: { name: true, slug: true, crestUrl: true } } },
            orderBy: [{ group: 'asc' }, { position: 'asc' }],
          },
        },
      },
    },
  });

  const season = competition?.seasons[0]; // el Mundial solo tiene una temporada (2026)

  if (competition == null || season == null) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{WORLD_CUP_2026.name}</h1>
        <p className="rounded-xl border border-dashed border-pitch-border p-6 text-center text-sm text-pitch-muted">
          Aún no se ha sincronizado el Mundial 2026. Lanza la sincronización (ver README) para cargar grupos,
          calendario y estadísticas.
        </p>
      </div>
    );
  }

  const [teams, recentResults, upcoming, topScorers, topAssists, topYellow] = await Promise.all([
    prisma.team.findMany({
      where: { seasons: { some: { seasonId: season.id } } },
      select: { id: true, name: true, slug: true, crestUrl: true, country: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.match.findMany({
      where: { seasonId: season.id, status: 'FINISHED' },
      include: { teams: { include: { team: { select: { name: true, crestUrl: true } } } } },
      orderBy: { kickoffAt: 'desc' },
      take: 10,
    }),
    prisma.match.findMany({
      where: { seasonId: season.id, status: { in: ['SCHEDULED', 'LIVE'] } },
      include: { teams: { include: { team: { select: { name: true, crestUrl: true } } } } },
      orderBy: { kickoffAt: 'asc' },
      take: 10,
    }),
    topPlayerStat(WORLD_CUP_2026.slug, 'goals', 5),
    topPlayerStat(WORLD_CUP_2026.slug, 'assists', 5),
    topPlayerStat(WORLD_CUP_2026.slug, 'yellowCards', 5),
  ]);

  const groupNames = [...new Set(season.standings.map((s) => s.group ?? 'Clasificación'))].sort();
  const standingsByGroup = groupNames.map((g) => ({
    group: g,
    rows: season.standings.filter((s) => (s.group ?? 'Clasificación') === g),
  }));

  return (
    <div className="space-y-10">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-pitch-accent">En juego · Canadá · México · EE. UU.</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{competition.name}</h1>
        <p className="text-sm text-pitch-muted">
          {teams.length} selecciones · fase de grupos y eliminatorias · estadísticas individuales y de equipo por partido.
        </p>
        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Link href="/mundial-2026/goleadores" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">
            Goleadores y asistencias →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Resultados recientes</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {recentResults.map((m) => {
            const home = m.teams.find((t) => t.isHome);
            const away = m.teams.find((t) => !t.isHome);
            return (
              <div key={m.id} className="rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm">
                <p className="mb-1 text-xs text-pitch-muted">{m.round ?? 'Mundial 2026'} · {formatKickoff(m.kickoffAt)}</p>
                <p className="font-medium">
                  {home?.team.name} <span className="text-pitch-accent">{home?.goals}–{away?.goals}</span> {away?.team.name}
                </p>
              </div>
            );
          })}
          {recentResults.length === 0 && <p className="text-sm text-pitch-muted">Sin resultados sincronizados todavía.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">En juego / Próximos</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {upcoming.map((m) => {
            const home = m.teams.find((t) => t.isHome);
            const away = m.teams.find((t) => !t.isHome);
            return (
              <div key={m.id} className="rounded-xl border border-pitch-border bg-pitch-card px-4 py-3 text-sm">
                <p className="mb-1 text-xs text-pitch-muted">
                  {m.round ?? 'Mundial 2026'} · {m.status === 'LIVE' ? <span className="text-pitch-accent">EN JUEGO</span> : formatKickoff(m.kickoffAt)}
                </p>
                <p className="font-medium">
                  {home?.team.name} {m.status === 'LIVE' && <span className="text-pitch-accent">{home?.goals}–{away?.goals}</span>} — {away?.team.name}
                </p>
              </div>
            );
          })}
          {upcoming.length === 0 && <p className="text-sm text-pitch-muted">Sin partidos pendientes en la base de datos.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Clasificación por grupo</h2>
        {standingsByGroup.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {standingsByGroup.map(({ group, rows }) => (
              <div key={group} className="overflow-hidden rounded-xl border border-pitch-border">
                <p className="border-b border-pitch-border bg-pitch-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">
                  {group}
                </p>
                <table className="w-full bg-pitch-card text-xs">
                  <thead className="text-left text-[10px] uppercase text-pitch-muted">
                    <tr className="border-b border-pitch-border">
                      <th className="px-2 py-1.5">#</th>
                      <th className="px-2 py-1.5">Selección</th>
                      <th className="px-2 py-1.5 text-right">PJ</th>
                      <th className="px-2 py-1.5 text-right">DG</th>
                      <th className="px-2 py-1.5 text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b border-pitch-border/50 last:border-0">
                        <td className="px-2 py-1.5 text-pitch-muted">{row.position}</td>
                        <td className="px-2 py-1.5">
                          <Link href={`/equipos/${row.team.slug}`} className="hover:text-pitch-accent">
                            {row.team.name}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 text-right">{row.played}</td>
                        <td className="px-2 py-1.5 text-right">{row.goalsFor - row.goalsAgainst}</td>
                        <td className="px-2 py-1.5 text-right font-semibold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-pitch-muted">Clasificación aún no sincronizada.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Individuales destacados</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: 'Goleadores', rows: topScorers },
            { title: 'Asistencias', rows: topAssists },
            { title: 'Tarjetas amarillas', rows: topYellow },
          ].map(({ title, rows }) => (
            <div key={title} className="rounded-xl border border-pitch-border bg-pitch-card p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pitch-muted">{title}</p>
              {rows.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {rows.map((r, i) => (
                    <li key={r.slug} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <span className="mr-1.5 text-pitch-muted">{i + 1}.</span>
                        <Link href={`/jugadores/${r.slug}`} className="hover:text-pitch-accent">{r.name}</Link>
                        {r.team != null && <span className="text-pitch-muted"> · {r.team}</span>}
                      </span>
                      <span className="font-semibold">{r.total}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-pitch-muted">Sin datos todavía.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-pitch-muted">Selecciones ({teams.length})</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/equipos/${t.slug}`}
              className="flex items-center gap-2 rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 text-sm hover:border-pitch-accent"
            >
              {t.crestUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.crestUrl} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-pitch-border" />
              )}
              <span className="truncate">{t.name}</span>
            </Link>
          ))}
          {teams.length === 0 && <p className="col-span-full text-sm text-pitch-muted">Selecciones aún no sincronizadas.</p>}
        </div>
      </section>
    </div>
  );
}
