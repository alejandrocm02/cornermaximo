import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export const metadata: Metadata = {
  title: 'Página no encontrada',
  robots: { index: false, follow: true },
};

const SECTIONS = [
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/partidos', label: 'Partidos' },
  { href: '/rankings', label: 'Rankings' },
] as const;

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="mx-auto max-w-2xl space-y-6 py-10 text-center sm:py-16">
      <p className="fs-eyebrow justify-center">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pitch-danger" />
        Error 404
      </p>
      <h1 id="not-found-title" className="text-3xl font-bold sm:text-4xl">
        No encontramos esta página
      </h1>
      <p className="text-sm leading-6 text-pitch-muted">
        Puede que el enlace haya cambiado o que el jugador, equipo o partido ya no esté en nuestra base de
        datos. Búscalo de nuevo o vuelve a una de las secciones principales.
      </p>
      <div className="text-left">
        <SearchBox />
      </div>
      <nav aria-label="Secciones principales" className="flex flex-wrap justify-center gap-2 text-sm">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="fs-chip transition hover:border-pitch-accent/40 hover:text-white"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm">
        <Link href="/" className="font-semibold text-pitch-accent hover:underline">
          Volver a la portada
        </Link>
      </p>
    </section>
  );
}
