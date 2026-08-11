/**
 * Agregador de noticias vía RSS de medios reputados.
 * Solo se guardan titular, resumen corto, fuente, fecha y enlace al original.
 * La categoría se deriva de las palabras del propio titular: un rumor solo se
 * etiqueta como rumor; "confirmado/oficial" exige que la fuente lo diga.
 */
import type { PrismaClient } from '@cornermaximo/db';

interface FeedConfig {
  url: string;
  source: string;
  /** 1 = oficial (clubes/competiciones) ... 5 = agregadores. */
  rank: number;
}

/** Medios deportivos reconocidos con RSS público estable. */
const FEEDS: FeedConfig[] = [
  { url: 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml', source: 'Marca', rank: 3 },
  { url: 'https://as.com/rss/futbol/portada.xml', source: 'Diario AS', rank: 3 },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', source: 'BBC Sport', rank: 3 },
  { url: 'https://www.skysports.com/rss/12040', source: 'Sky Sports', rank: 3 },
];

/** Clasificación por palabras del titular (nunca eleva un rumor a confirmado). */
const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: 'confirmados', pattern: /\b(oficial|officially|confirmad[oa]|confirmed|announces?|anuncia)\b/i },
  { category: 'rumores', pattern: /\b(rumor|rumour|interesa|interested|targets?|quiere fichar|sondea|linked|acerca posturas|podría fichar)\b/i },
  { category: 'fichajes', pattern: /\b(fichaje|ficha a|traspaso|transfer|signing|signs?|cesión|cedido|loan)\b/i },
  { category: 'renovaciones', pattern: /\b(renueva|renovación|renewal|extends? contract|amplía contrato)\b/i },
  { category: 'lesiones', pattern: /\b(lesión|lesionado|injury|injured|baja por|rotura|esguince)\b/i },
  { category: 'mundial-2026', pattern: /\b(mundial|world cup|fifa 2026)\b/i },
];

export const NEWS_CATEGORIES = [
  'ultima-hora',
  'fichajes',
  'rumores',
  'confirmados',
  'lesiones',
  'renovaciones',
  'competiciones',
  'mundial-2026',
] as const;

function classify(title: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule.category;
  }
  return 'ultima-hora';
}

function decode(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

interface ParsedItem {
  guid: string;
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: Date;
}

/** Parser RSS mínimo sin dependencias (title/link/guid/pubDate/description/imagen). */
export function parseRss(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];
  for (const block of blocks) {
    const pick = (tag: string): string | null => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m != null ? decode(m[1]!) : null;
    };
    const title = pick('title');
    const link = pick('link');
    const pub = pick('pubDate') ?? pick('dc:date');
    if (title == null || title === '' || link == null || pub == null) continue;
    const publishedAt = new Date(pub);
    if (Number.isNaN(publishedAt.getTime())) continue;
    const image =
      block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*url="([^"]+)"/i)?.[1] ?? null;
    const rawSummary = pick('description');
    items.push({
      guid: pick('guid') ?? link,
      title,
      summary: rawSummary != null && rawSummary !== '' ? rawSummary.slice(0, 280) : null,
      url: link,
      imageUrl: image,
      publishedAt,
    });
  }
  return items;
}

/** Descarga los feeds, deduplica por guid y vincula equipos/jugadores/competición. */
export async function syncNews(db: PrismaClient): Promise<number> {
  // Entidades para vincular titulares (solo nombres suficientemente largos para no dar falsos positivos)
  const [teams, players, wc] = await Promise.all([
    db.team.findMany({ select: { id: true, name: true } }),
    db.player.findMany({
      where: { knownAs: { not: null } },
      select: { id: true, knownAs: true },
    }),
    db.competition.findFirst({ where: { type: 'CUP' }, select: { id: true } }),
  ]);
  const teamMatchers = teams.filter((t) => t.name.length >= 5);
  const playerMatchers = players.filter((p) => (p.knownAs?.length ?? 0) >= 9);

  let stored = 0;
  for (const feed of FEEDS) {
    let xml: string;
    try {
      const res = await fetch(feed.url, {
        headers: { 'user-agent': 'CornerMaximoBot/1.0 (+agregador de titulares con enlace a la fuente)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue; // un feed caído no debe tumbar la sincronización
    }

    const freshSince = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const item of parseRss(xml).slice(0, 30)) {
      // Algunos feeds (portadas) recuperan artículos antiguos: no son "última hora"
      if (item.publishedAt.getTime() < freshSince) continue;
      const lowerTitle = item.title.toLowerCase();
      const team = teamMatchers.find((t) => lowerTitle.includes(t.name.toLowerCase()));
      const player = playerMatchers.find((p) => lowerTitle.includes(p.knownAs!.toLowerCase()));
      const category = classify(item.title);
      try {
        // La URL es la identidad real de una noticia: algunos feeds cambian el guid
        // entre descargas y duplicarían el mismo artículo.
        await db.newsItem.upsert({
          where: { guid: item.url },
          update: { title: item.title, summary: item.summary, imageUrl: item.imageUrl },
          create: {
            guid: item.url,
            title: item.title,
            summary: item.summary,
            url: item.url,
            source: feed.source,
            sourceRank: feed.rank,
            imageUrl: item.imageUrl,
            category,
            publishedAt: item.publishedAt,
            teamId: team?.id ?? null,
            playerId: player?.id ?? null,
            competitionId: category === 'mundial-2026' ? (wc?.id ?? null) : null,
          },
        });
        stored++;
      } catch {
        // conflicto de guid en paralelo: se ignora
      }
    }
  }

  // Limpieza: filas antiguas guardadas bajo un guid distinto para la misma URL
  await db.$executeRaw`
    DELETE FROM "NewsItem" a
    USING "NewsItem" b
    WHERE a."url" = b."url"
      AND a."id" <> b."id"
      AND (a."publishedAt" < b."publishedAt" OR (a."publishedAt" = b."publishedAt" AND a."id" < b."id"))`;

  return stored;
}
