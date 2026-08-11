import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/cuenta',
          '/mi-corner',
          '/favoritos',
          '/watchlists',
          '/alertas',
          '/auth/',
          '/brand-guide',
          '/login',
          '/registro',
          '/recuperar-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
