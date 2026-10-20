import { getSitemapEntries, renderSitemapXml, SITEMAP_CACHE_CONTROL } from '@/lib/sitemap';
import { getSiteUrl } from '@/lib/site-url';

// Sustituye a app/sitemap.ts. Con `revalidate` en el archivo de metadatos,
// producción siguió sirviendo el sitemap generado en el build del 14-oct
// durante días: no entraban jugadores ni partidos nuevos. Aquí la respuesta
// se genera bajo demanda y la cachea la CDN de Vercel una hora; pasado ese
// tiempo se sirve la copia anterior mientras se regenera en segundo plano.
// Resultado: unas pocas lecturas a Neon por hora (una por región de la CDN que
// reciba visitas), sin depender del build.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const entries = await getSitemapEntries();
    return new Response(renderSitemapXml(getSiteUrl(), entries), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': SITEMAP_CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error('sitemap: no se pudo leer la base de datos', error);
    // Un 503 transitorio hace que Google reintente más tarde. Publicar un
    // sitemap con solo las rutas estáticas le diría que el resto ha desaparecido.
    return new Response('Sitemap temporalmente no disponible.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '3600',
      },
    });
  }
}
