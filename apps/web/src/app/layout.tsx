import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import { FavoriteHomeBanner } from '@/components/FavoriteHomeBanner';
import { MainNav } from '@/components/MainNav';
import { SiteFooter } from '@/components/SiteFooter';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Tipografía del sistema de diseño.
 * - Inter para el cuerpo: pensada para interfaces densas en datos y con
 *   excelentes cifras tabulares para las tablas de estadísticas.
 * - Space Grotesk para titulares y cifras destacadas: geométrica y técnica,
 *   aporta el carácter deportivo y futurista sin restar legibilidad.
 * `display: 'swap'` evita el texto invisible mientras se descarga la fuente.
 */
const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const fontDisplay = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

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

export const viewport: Viewport = {
  themeColor: '#070B14',
  colorScheme: 'dark',
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
    <html lang="es" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body className="min-h-dvh">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <a
          href="#contenido"
          className="sr-only z-50 rounded-lg bg-pitch-accent px-4 py-2 font-semibold text-black focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Saltar al contenido principal
        </a>

        {/* Cabecera fija translúcida. El degradado inferior sustituye al borde
            plano y da sensación de profundidad al desplazar el contenido. */}
        <header className="sticky top-0 z-30 border-b border-pitch-border/70 bg-pitch-bg/80 backdrop-blur-xl supports-[backdrop-filter]:bg-pitch-bg/60">
          <MainNav />
          <div aria-hidden="true" className="fs-rule absolute inset-x-0 bottom-0" />
        </header>

        <FavoriteHomeBanner />

        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-8 outline-none sm:px-6 lg:px-8 lg:py-12"
        >
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
