import { prisma } from '@futstats/db';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ApuestasClient, type UpcomingMatch } from '@/components/apuestas/ApuestasClient';
import { RESPONSIBLE_NOTICE } from '@/components/apuestas/betTypes';
import { roundLabel } from '@/lib/football';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const hasFilters = sp.liga != null && sp.liga !== '';
  return {
    title: { absolute: 'Creador de apuestas y calculadora de cuotas | FutStats' },
    description:
      'Crea apuestas simples o combinadas, calcula probabilidades y retornos potenciales y guarda simulaciones basadas en estadísticas de fútbol.',
    alternates: { canonical: '/apuestas' },
    ...(hasFilters ? { robots: { index: false } } : {}),
  };
}

export default async function ApuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ liga?: string }>;
}) {
  const sp = await searchParams;
  const liga = (sp.liga ?? '').slice(0, 50);

  const [competitions, matches] = await Promise.all([
    prisma.competition.findMany({ where: { seasons: { some: { isCurrent: true } } }, orderBy: { name: 'asc' } }),
    prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date(), lte: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) },
        ...(liga !== '' ? { season: { competition: { slug: liga } } } : {}),
      },
      include: {
        season: { include: { competition: { select: { name: true, slug: true } } } },
        teams: { include: { team: { select: { name: true } } } },
      },
      orderBy: { kickoffAt: 'asc' },
      take: 30,
    }),
  ]);

  const upcoming: UpcomingMatch[] = matches
    .map((m) => {
      const home = m.teams.find((t) => t.isHome)?.team.name;
      const away = m.teams.find((t) => !t.isHome)?.team.name;
      if (home == null || away == null) return null;
      return {
        id: m.id,
        competition: m.season.competition.name,
        round: m.round != null ? roundLabel(m.round) : null,
        kickoffAt: m.kickoffAt.toISOString(),
        home,
        away,
      };
    })
    .filter((m): m is UpcomingMatch => m != null);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Apuestas' }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">Crea y analiza tu apuesta</h1>
          <p className="mt-1 max-w-2xl text-sm text-pitch-muted">
            Combina pronósticos, introduce tus cuotas y calcula el retorno potencial antes de guardar
            una simulación.
          </p>
        </div>
        <Link
          href="/apuestas/mis-apuestas"
          className="rounded-lg border border-pitch-border px-4 py-2 text-sm text-pitch-muted hover:border-pitch-accent hover:text-white"
        >
          Mis apuestas e historial
        </Link>
      </div>

      <p className="fs-panel p-4 text-xs text-pitch-muted">
        {RESPONSIBLE_NOTICE} Las cuotas las introduces tú manualmente: FutStats no muestra cuotas
        oficiales ni en tiempo real, no procesa pagos y no se conecta a casas de apuestas. Solo se
        ofrecen mercados que pueden verificarse después con el marcador final registrado en FutStats.
      </p>

      {/* Filtro por liga */}
      <form method="GET" action="/apuestas" className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-pitch-muted">Competición</span>
          <select name="liga" defaultValue={liga} className="w-full rounded-lg border border-pitch-border bg-pitch-card px-3 py-2 sm:w-auto">
            <option value="">Todas</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black">Filtrar</button>
        {liga !== '' && (
          <Link href="/apuestas" className="rounded-lg border border-pitch-border px-4 py-2 text-pitch-muted hover:text-white">Limpiar</Link>
        )}
      </form>

      <ApuestasClient matches={upcoming} />

      {/* Juego responsable */}
      <section aria-label="Juego responsable" className="fs-panel p-4 text-sm">
        <h2 className="text-base font-bold">Juego responsable</h2>
        <div className="mt-2 space-y-2 text-xs text-pitch-muted">
          <p>
            Las apuestas con dinero real implican riesgo económico y pueden generar pérdidas y
            comportamientos problemáticos. Si decides apostar fuera de esta herramienta, establece
            límites de tiempo y dinero antes de empezar y no intentes recuperar pérdidas con nuevas
            apuestas.
          </p>
          <p>
            Las estadísticas describen lo que ya ocurrió: no garantizan resultados futuros, y ningún
            pronóstico es infalible. El nivel de riesgo que muestra el cupón es orientativo.
          </p>
          <p>
            Las apuestas están prohibidas para menores de 18 años. Si el juego te está causando
            problemas a ti o a alguien cercano, existe ayuda especializada: en España puedes
            informarte en el teléfono 900 200 225 (Ayuda al Jugador, gratuito) o en los servicios de
            salud de tu comunidad.
          </p>
        </div>
      </section>

      <p className="text-xs text-pitch-muted">
        Tus cupones y simulaciones se guardan solo en este navegador (almacenamiento local). No se
        envían a ningún servidor, no se sincronizan entre dispositivos y puedes borrarlos desde{' '}
        <Link href="/apuestas/mis-apuestas" className="text-pitch-accent hover:underline">Mis apuestas</Link>{' '}
        o limpiando los datos del navegador.
      </p>
    </div>
  );
}
