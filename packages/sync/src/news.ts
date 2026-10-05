/**
 * Agregador de noticias vía RSS de medios reputados.
 * Solo se guardan titular, resumen corto, fuente, fecha y enlace al original.
 * La categoría se deriva de las palabras del propio titular: un rumor solo se
 * etiqueta como rumor; "confirmado/oficial" exige que la fuente lo diga.
 */
import type { PrismaClient } from '@cornermaximo/db';
import { foldAccents } from '@cornermaximo/shared';

interface FeedConfig {
  url: string;
  source: string;
  /** 1 = oficial (clubes/competiciones) ... 5 = agregadores. */
  rank: number;
}

/** Medios deportivos reconocidos con RSS público estable. */
const FEEDS: FeedConfig[] = [
  { url: 'https://e00-marca.uecdn.es/rss/futbol/primera-division.xml', source: 'Marca', rank: 3 },
  // El antiguo as.com/rss/futbol/portada.xml sigue respondiendo 200, pero quedó
  // congelado en 2022: todas sus noticias caían por el filtro de antigüedad.
  { url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/', source: 'Diario AS', rank: 3 },
  { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml', source: 'BBC Sport', rank: 3 },
  // 11095 es la sección de fútbol; 12040 era el feed general (NBA, hípica...).
  { url: 'https://www.skysports.com/rss/11095', source: 'Sky Sports', rank: 3 },
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

/** Abreviaturas de zona que usan algunos feeds y que `Date` no reconoce. */
const ZONE_OFFSETS: Record<string, string> = { BST: '+0100', CET: '+0100', CEST: '+0200', WET: '+0000', WEST: '+0100' };

/**
 * Fecha de publicación. Sky Sports firma en "BST" durante el horario de verano
 * británico; `new Date()` lo rechaza y el medio desaparecía medio año.
 */
export function parsePubDate(value: string): Date | null {
  const normalized = value.trim().replace(/\s([A-Z]{3,4})$/, (match, zone: string) =>
    ZONE_OFFSETS[zone] != null ? ` ${ZONE_OFFSETS[zone]}` : match,
  );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Primera imagen adjunta al artículo. Los feeds MRSS mezclan fotos y vídeos en
 * las mismas etiquetas; un .mp4 guardado como imagen se pinta roto.
 */
function pickImage(block: string): string | null {
  const tags = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const url = tag.match(/\burl="([^"]+)"/i)?.[1];
    if (url == null) continue;
    const isVideo =
      /\b(?:medium|type)="video/i.test(tag) || /\.(?:mp4|m3u8|webm|mov)(?:[?#]|$)/i.test(url);
    if (!isVideo) return url;
  }
  return null;
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
    const publishedAt = parsePubDate(pub);
    if (publishedAt == null) continue;
    const image = pickImage(block);
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
    const parsed = parseRss(xml).slice(0, 30);
    // Un feed que responde pero no trae nada reciente está abandonado o ha
    // cambiado de formato; sin este aviso el medio desaparece sin dejar rastro.
    if (!parsed.some((item) => item.publishedAt.getTime() >= freshSince)) {
      console.warn(`syncNews: ${feed.source} no devuelve noticias de los últimos 30 días (${feed.url})`);
    }
    for (const item of parsed) {
      // Algunos feeds (portadas) recuperan artículos antiguos: no son "última hora"
      if (item.publishedAt.getTime() < freshSince) continue;
      // Sin tildes en ambos lados: "Cadiz" (prensa inglesa) y "Cádiz" enlazan igual.
      const foldedTitle = foldAccents(item.title);
      const team = teamMatchers.find((t) => foldedTitle.includes(foldAccents(t.name)));
      const player = playerMatchers.find((p) => foldedTitle.includes(foldAccents(p.knownAs!)));
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
