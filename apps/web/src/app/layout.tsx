import type { Metadata } from 'next';
import { MainNav } from '@/components/MainNav';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FutStats — Análisis de futbolistas', template: '%s | FutStats' },
  description:
    'Base de datos y análisis de futbolistas de las 5 grandes ligas (2025-26 y 2026-27) y del Mundial 2026: rendimiento en los últimos 5 partidos, clasificaciones y estadísticas colectivas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
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
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-pitch-muted">
          Datos: API-Football (plan Pro). Sincronización automática cada hora.
        </footer>
      </body>
    </html>
  );
}
