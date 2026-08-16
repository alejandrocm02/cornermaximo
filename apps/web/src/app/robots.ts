import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-url';

const BASE_URL = getSiteUrl();

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
