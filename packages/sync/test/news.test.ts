/**
 * Tests del parser de noticias con la forma real de los feeds MRSS (Diario AS):
 * guid/link sin CDATA y adjuntos que pueden ser vídeo o imagen.
 */
import { describe, expect, it } from 'vitest';
import { parsePubDate, parseRss } from '../src/news';

const feed = (media: string) => `<?xml version="1.0"?><rss><channel>
  <item>
    <guid isPermaLink="true">https://as.com/futbol/primera/ejemplo-n/</guid>
    <title>Titular de ejemplo</title>
    <pubDate>Mon, 05 Oct 2026 05:03:30 GMT</pubDate>
    <link>https://as.com/futbol/primera/ejemplo-n/</link>
    <description>Resumen de ejemplo.</description>
    ${media}
  </item>
</channel></rss>`;

describe('parsePubDate', () => {
  it('entiende el horario de verano británico que usa Sky Sports', () => {
    expect(parsePubDate('Mon, 05 Oct 2026 09:41:00 BST')?.toISOString()).toBe('2026-10-05T08:41:00.000Z');
  });

  it('mantiene los formatos estándar', () => {
    expect(parsePubDate('Mon, 05 Oct 2026 05:03:30 GMT')?.toISOString()).toBe('2026-10-05T05:03:30.000Z');
    expect(parsePubDate('Tue, 7 Jun 2022 04:55:07 +0100')?.toISOString()).toBe('2022-06-07T03:55:07.000Z');
  });

  it('devuelve null si no es una fecha', () => {
    expect(parsePubDate('no es una fecha')).toBeNull();
  });
});

describe('parseRss', () => {
  it('lee titular, enlace, fecha y resumen', () => {
    const [item] = parseRss(feed(''));
    expect(item).toMatchObject({
      title: 'Titular de ejemplo',
      url: 'https://as.com/futbol/primera/ejemplo-n/',
      summary: 'Resumen de ejemplo.',
      imageUrl: null,
    });
    expect(item!.publishedAt.toISOString()).toBe('2026-10-05T05:03:30.000Z');
  });

  it('no guarda un vídeo como imagen y usa la primera foto disponible', () => {
    const [item] = parseRss(
      feed(`<media:content url="https://vdmedia.as.com/clip_1200.mp4" duration="221560" type="video/mp4" medium="video"></media:content>
    <media:content url="https://img.asmedia.epimg.net/foto.jpg" type="image/jpeg" medium="image"/>`),
    );
    expect(item!.imageUrl).toBe('https://img.asmedia.epimg.net/foto.jpg');
  });

  it('deja la noticia sin imagen si solo hay vídeo', () => {
    const [item] = parseRss(feed('<media:content url="https://vdmedia.as.com/clip.mp4?x=1" medium="video"/>'));
    expect(item!.imageUrl).toBeNull();
  });

  it('descarta entradas sin fecha válida', () => {
    expect(parseRss(feed('').replace('Mon, 05 Oct 2026 05:03:30 GMT', 'no es una fecha'))).toHaveLength(0);
  });
});
