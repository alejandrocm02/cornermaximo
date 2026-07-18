import type { Metadata } from 'next';
import { MainNav } from '@/components/MainNav';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: { default: 'Estadísticas de jugadores, rankings y resultados | FutStats', template: '%s | FutStats' },
  description:
    'Consulta estadísticas, rankings y rendimiento de más de 4.000 futbolistas. Compara jugadores y sigue el Mundial 2026.',
  openGraph: {
    type: 'website',
    siteName: 'FutStats',
    locale: 'es_ES',
  },
  twitter: { card: 'summary' },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FutStats',
  url: BASE_URL,
  inLanguage: 'es',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <a
          href="#contenido"
          className="sr-only z-50 rounded-lg bg-pitch-accent px-4 py-2 font-medium text-black focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Saltar al contenido principal
        </a>
        <header className="sticky top-0 z-30 border-b border-pitch-border bg-pitch-card/80 backdrop-blur">
          <MainNav />
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8 outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
