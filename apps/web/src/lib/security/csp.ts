const API_SPORTS_MEDIA = [
  'https://media.api-sports.io',
  'https://media-1.api-sports.io',
  'https://media-2.api-sports.io',
  'https://media-3.api-sports.io',
].join(' ');

export function createContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
    // Tailwind usa CSS estático, pero varios componentes conservan atributos
    // style dinámicos. El nonce elimina unsafe-inline de scripts, el vector XSS.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${API_SPORTS_MEDIA}`,
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
