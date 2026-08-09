import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FutStats',
    short_name: 'FutStats',
    description: 'Estadísticas, seguimiento y alertas de fútbol.',
    start_url: '/mi-futstats',
    display: 'standalone',
    background_color: '#07130d',
    theme_color: '#07130d',
    lang: 'es',
    categories: ['sports'],
    icons: [
      {
        src: '/futstats-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
