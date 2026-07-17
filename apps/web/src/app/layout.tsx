import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'FutStats — Análisis de futbolistas', template: '%s | FutStats' },
  description:
    'Base de datos y análisis de futbolistas de las 5 grandes ligas: rendimiento en los últimos 5 partidos.',
};

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/mundial-2026', label: 'Mundial 2026' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/comparador', label: 'Comparador' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="border-b border-pitch-border bg-pitch-card/60 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Fut<span className="text-pitch-accent">Stats</span>
            </Link>
            <div className="flex gap-4 text-sm text-pitch-muted">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-pitch-muted">
          Datos: API-Football. Actualización diferida según presupuesto disponible.
        </footer>
      </body>
    </html>
  );
}
