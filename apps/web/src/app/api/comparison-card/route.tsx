import { ImageResponse } from 'next/og';
import { prisma } from '@cornermaximo/db';
import { getPlayerAdvancedAnalytics } from '@/lib/playerAdvanced';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSITION_LABEL = { GK: 'Portero', DF: 'Defensa', MF: 'Centrocampista', FW: 'Delantero' } as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const p1 = url.searchParams.get('p1') ?? '';
  const p2 = url.searchParams.get('p2') ?? '';
  if (!/^[a-z0-9-]{1,100}$/i.test(p1) || !/^[a-z0-9-]{1,100}$/i.test(p2) || p1 === p2) {
    return new Response('Comparación inválida', { status: 422 });
  }

  const players = await prisma.player.findMany({
    where: { slug: { in: [p1, p2] } },
    select: {
      id: true,
      slug: true,
      fullName: true,
      knownAs: true,
      photoUrl: true,
      currentTeam: { select: { name: true } },
      positions: { where: { isPrimary: true }, select: { group: true }, take: 1 },
    },
  });
  if (players.length !== 2) return new Response('Jugador no encontrado', { status: 404 });

  const ordered = [p1, p2].map((slug) => players.find((player) => player.slug === slug)!);
  if (ordered.some((player) => player.positions[0]?.group == null)) return new Response('Sin posición', { status: 422 });

  const analytics = await Promise.all(
    ordered.map((player) => getPlayerAdvancedAnalytics(player.id, player.positions[0]!.group)),
  );
  const entries = ordered.map((player, index) => ({
    name: player.knownAs ?? player.fullName,
    team: player.currentTeam?.name ?? 'Sin equipo',
    position: POSITION_LABEL[player.positions[0]!.group],
    photoUrl: player.photoUrl,
    analytics: analytics[index]!,
  }));

  const commonKeys = new Set(entries[0]!.analytics.metrics.map((metric) => metric.key));
  const metrics = entries[1]!.analytics.metrics
    .filter((metric) => commonKeys.has(metric.key))
    .slice(0, 5)
    .map((right) => ({
      left: entries[0]!.analytics.metrics.find((metric) => metric.key === right.key)!,
      right,
    }));

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#07130d', color: 'white', padding: 56, fontFamily: 'Arial' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>CornerMaximo</div>
          <div style={{ display: 'flex', fontSize: 18, color: '#7fffb2' }}>COMPARADOR 2.0</div>
        </div>
        <div style={{ display: 'flex', marginTop: 36, gap: 24, flex: 1 }}>
          {entries.map((entry) => (
            <div key={entry.name} style={{ display: 'flex', flexDirection: 'column', flex: 1, border: '1px solid #214333', borderRadius: 24, padding: 28, background: '#0b1b13' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                {entry.photoUrl ? <img src={entry.photoUrl} width="84" height="84" style={{ borderRadius: 42, objectFit: 'cover' }} /> : null}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: 27, fontWeight: 800 }}>{entry.name}</div>
                  <div style={{ display: 'flex', fontSize: 15, color: '#a8b8ae', marginTop: 5 }}>{entry.team} · {entry.position}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                {[
                  ['Min', entry.analytics.minutes.toLocaleString('es-ES')],
                  ['PJ', String(entry.analytics.appearances)],
                  ['Rating', entry.analytics.avgRating?.toFixed(2) ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: 12, borderRadius: 14, background: '#10271b' }}>
                    <div style={{ display: 'flex', fontSize: 20, fontWeight: 800 }}>{value}</div>
                    <div style={{ display: 'flex', fontSize: 12, color: '#a8b8ae' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24, border: '1px solid #214333', borderRadius: 22, padding: 24, background: '#0b1b13' }}>
          {metrics.map(({ left, right }) => (
            <div key={left.key} style={{ display: 'flex', alignItems: 'center', padding: '7px 0', fontSize: 16 }}>
              <div style={{ display: 'flex', width: '34%', fontWeight: 700 }}>{left.displayValue} · P{left.percentile ?? '—'}</div>
              <div style={{ display: 'flex', width: '32%', justifyContent: 'center', color: '#a8b8ae' }}>{left.label}</div>
              <div style={{ display: 'flex', width: '34%', justifyContent: 'flex-end', fontWeight: 700 }}>{right.displayValue} · P{right.percentile ?? '—'}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, color: '#82988a', fontSize: 13 }}>
          <div style={{ display: 'flex' }}>Datos de temporada · métricas por 90 y percentiles posicionales</div>
          <div style={{ display: 'flex' }}>cornermaximo-web-neon.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
