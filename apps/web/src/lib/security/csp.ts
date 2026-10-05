const API_SPORTS_MEDIA = [
  'https://media.api-sports.io',
  'https://media-1.api-sports.io',
  'https://media-2.api-sports.io',
  'https://media-3.api-sports.io',
].join(' ');

/**
 * Servidores de imágenes de los medios cuyos titulares se agregan
 * (`packages/sync/src/news.ts`). Sin ellos las miniaturas de /noticias,
 * /fichajes y las fichas de equipo quedaban bloqueadas. Lista cerrada: al
 * añadir un medio hay que añadir aquí su servidor de imágenes.
 */
const NEWS_MEDIA = [
  'https://objetos.estaticos-marca.com', // Marca
  'https://img.asmedia.epimg.net', // Diario AS (fotos)
  'https://vdmedia.as.com', // Diario AS (miniaturas de vídeo)
  'https://ichef.bbci.co.uk', // BBC Sport
  'https://*.365dm.com', // Sky Sports reparte entre e0, e1, e2...
].join(' ');

export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
    // Tailwind usa CSS estático, pero varios componentes conservan atributos
    // style dinámicos. El nonce elimina unsafe-inline de scripts, el vector XSS.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${API_SPORTS_MEDIA} ${NEWS_MEDIA}`,
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    'frame-src https://challenges.cloudflare.com',
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
