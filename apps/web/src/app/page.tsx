import { prisma } from '@futstats/db';
import { BIG_FIVE_CURRENT_SEASON, BIG_FIVE_PREVIOUS_SEASON, WORLD_CUP_2026 } from '@futstats/shared';
import Link from 'next/link';
import { MatchRows } from '@/components/MatchRows';
import { SearchBox } from '@/components/SearchBox';
import { SectionHeader } from '@/components/SectionHeader';
import { seasonLabel } from '@/lib/football';
import { topLeaguePlayers } from '@/lib/leaderboards';
import { topPlayerStat } from '@/lib/worldCupStats';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: { absolute: 'CornerMaximo | Sports Intelligence' },
  description: 'Partidos, estadísticas, scouting, rankings y actualidad del fútbol en una plataforma deportiva de inteligencia y análisis.',
  alternates: { canonical: '/' },
};

function roundedCount(n: number): string { return Math.max(100, Math.floor(n / 100) * 100).toLocaleString('es-ES'); }

const QUICK_ACTIONS = [
  { href: '/partidos', title: 'Partidos', desc: 'Calendario, resultados y seguimiento.' },
  { href: '/scouting', title: 'CM Scout', desc: 'Descubre perfiles mediante filtros y métricas.' },
  { href: '/comparador', title: 'CM Compare', desc: 'Compara dos futbolistas frente a frente.' },
  { href: '/rankings', title: 'Rankings', desc: 'Líderes por goles, asistencias y más.' },
  { href: '/noticias', title: 'Noticias', desc: 'Actualidad, mercado y fichajes.' },
  { href: '/mi-futstats', title: 'Mi Corner', desc: 'Favoritos, watchlists y alertas.' },
];

export default async function HomePage() {
  const [playersCount, topScorers, topAssists, topSaves, latestNews, recentMatches, upcomingMatches, wcScorers] = await Promise.all([
    prisma.player.count(), topLeaguePlayers('goals', 6), topLeaguePlayers('assists', 5), topLeaguePlayers('saves', 5),
    prisma.newsItem.findMany({ orderBy: { publishedAt: 'desc' }, take: 4, select: { id: true, title: true, url: true, source: true, publishedAt: true } }),
    prisma.match.findMany({ where: { status: 'FINISHED' }, include: { teams: { include: { team: { select: { name: true, slug: true } } } }, season: { include: { competition: { select: { name: true, slug: true } } } } }, orderBy: { kickoffAt: 'desc' }, take: 5 }),
    prisma.match.findMany({ where: { status: 'SCHEDULED', kickoffAt: { gte: new Date() } }, include: { teams: { include: { team: { select: { name: true, slug: true } } } }, season: { include: { competition: { select: { name: true, slug: true } } } } }, orderBy: { kickoffAt: 'asc' }, take: 5 }),
    topPlayerStat(WORLD_CUP_2026.slug, 'goals', 3),
  ]);
  return <div className="space-y-14 sm:space-y-20">
    <section className="relative isolate -mt-4 overflow-hidden rounded-4xl border border-pitch-border/70 px-4 py-12 sm:px-8 sm:py-16"><div aria-hidden="true" className="pointer-events-none absolute left-1/4 top-0 -z-10 h-64 w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pitch-accent/20 blur-3xl"/><div className="max-w-4xl"><p className="fs-eyebrow">CORNERMAXIMO · SPORTS INTELLIGENCE</p><h1 className="mt-5 text-4xl font-bold leading-[1.02] tracking-tight sm:text-5xl lg:text-7xl">TU DEPORTE.<br/><span className="fs-gradient-text">TUS DATOS.</span><br/>TU VENTAJA.</h1><p className="mt-6 max-w-2xl text-base text-pitch-muted sm:text-lg">Partidos. Datos. Scouting. Todo el fútbol en un solo lugar. Analiza más de {roundedCount(playersCount)} futbolistas.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/partidos" className="fs-btn-primary">Explorar partidos</Link><Link href="/mi-futstats" className="fs-btn-ghost">Abrir Mi Corner</Link></div><div className="mt-8 max-w-xl"><SearchBox /></div><p className="mt-4 text-2xs uppercase tracking-[0.16em] text-pitch-muted">{seasonLabel(BIG_FIVE_PREVIOUS_SEASON)} · {seasonLabel(BIG_FIVE_CURRENT_SEASON)} · Mundial 2026</p></div></section>
    <section><SectionHeader eyebrow="Hoy" title="Partidos"/><div className="grid gap-8 lg:grid-cols-2"><div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-pitch-muted">Próximos</p><MatchRows matches={upcomingMatches} empty="Sin partidos programados."/></div><div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-pitch-muted">Resultados</p><MatchRows matches={recentMatches} empty="Sin partidos sincronizados."/></div></div></section>
    <section><SectionHeader eyebrow="En forma" title="Jugadores destacados" action={{href:'/rankings',label:'Ver rankings'}}/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{topScorers.map((p,i)=><Link key={p.slug} href={`/jugadores/${p.slug}`} className="fs-panel-interactive flex items-center gap-3 p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-pitch-elevated text-xs font-bold tabular-nums text-pitch-muted">{i+1}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-white">{p.name}</span><span className="block truncate text-xs text-pitch-muted">{p.team??'—'}</span></span><span className="text-right"><span className="fs-stat block text-pitch-accent">{p.total}</span><span className="text-2xs uppercase text-pitch-muted">goles</span></span></Link>)}</div></section>
    <section><SectionHeader eyebrow="Intelligence tools" title="Explora CornerMaximo"/><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{QUICK_ACTIONS.map(a=><Link key={a.href} href={a.href} className="fs-panel-interactive group p-5"><p className="font-display font-semibold text-white">{a.title}</p><p className="mt-2 text-xs leading-5 text-pitch-muted">{a.desc}</p><span className="mt-4 inline-block text-pitch-accent">→</span></Link>)}</div></section>
    <section><SectionHeader eyebrow="Líderes" title="Rankings"/><div className="grid gap-4 md:grid-cols-3">{([{title:'Asistencias',rows:topAssists},{title:'Paradas',rows:topSaves},{title:'Mundial 2026 · Goles',rows:wcScorers.map(r=>({slug:r.slug,name:r.name,team:r.team,total:r.total}))}] as const).map(b=><div key={b.title} className="fs-panel overflow-hidden"><p className="border-b border-pitch-border/60 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-pitch-muted">{b.title}</p>{b.rows.map((r,i)=><Link key={r.slug} href={`/jugadores/${r.slug}`} className="flex items-center gap-3 border-b border-pitch-border/40 px-4 py-3 last:border-0"><span className="text-xs text-pitch-muted">{i+1}</span><span className="min-w-0 flex-1 truncate text-sm">{r.name}</span><strong className="tabular-nums text-pitch-accent">{r.total}</strong></Link>)}</div>)}</div></section>
    {latestNews.length>0&&<section><SectionHeader eyebrow="Última hora" title="Noticias" action={{href:'/noticias',label:'Todas'}}/><ul className="fs-panel divide-y divide-pitch-border/60">{latestNews.map(n=><li key={n.id}><a href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-4 text-sm hover:bg-pitch-elevated/40"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pitch-danger"/><span><span className="text-pitch-subtle">{n.title}</span><span className="mt-1 block text-2xs uppercase text-pitch-muted">{n.source}</span></span></a></li>)}</ul></section>}
    <section><Link href="/mundial-2026" className="group relative isolate block overflow-hidden rounded-4xl border border-pitch-accent/30 p-6 transition hover:border-pitch-accent/60 sm:p-10"><p className="fs-eyebrow">Mundial 2026</p><h2 className="mt-3 text-2xl font-bold sm:text-3xl">Datos, grupos y eliminatorias</h2><p className="mt-3 max-w-2xl text-sm text-pitch-muted">Sigue selecciones y estadísticas partido a partido.{wcScorers.length>0&&<> Líder: <span className="font-semibold text-white">{wcScorers[0]!.name}</span> · {wcScorers[0]!.total} goles.</>}</p><p className="mt-5 text-sm font-semibold text-pitch-accent">Abrir Mundial 2026 →</p></Link></section>
  </div>;
}
