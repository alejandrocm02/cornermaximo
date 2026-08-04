import Link from 'next/link';
import { getPublicDataHealth, type DataHealthLevel } from '@/lib/dataHealth';

const FOOTER_LINKS = [
  { href: '/sobre', label: 'Sobre FutStats' },
  { href: '/metodologia', label: 'Fuente y metodología' },
  { href: '/estado-datos', label: 'Estado de los datos' },
  { href: '/privacidad', label: 'Política de privacidad' },
  { href: '/aviso-legal', label: 'Aviso legal' },
];

const SECTIONS = [
  { href: '/partidos', label: 'Partidos' },
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/noticias', label: 'Noticias' },
  { href: '/analizador', label: 'Analizador' },
  { href: '/mundial-2026', label: 'Mundial 2026' },
];

const STATUS: Record<DataHealthLevel, { label: string; dotClass: string }> = {
  OPERATIONAL: { label: 'Datos actualizados', dotClass: 'bg-pitch-accent' },
  DEGRADED: { label: 'Actualización con retrasos', dotClass: 'bg-amber-300' },
  ATTENTION: { label: 'Datos en revisión', dotClass: 'bg-pitch-danger' },
  UNKNOWN: { label: 'Estado no disponible', dotClass: 'bg-pitch-muted' },
};

export async function SiteFooter() {
  let health: Awaited<ReturnType<typeof getPublicDataHealth>> | null = null;
  try {
    health = await getPublicDataHealth();
  } catch {
    // Durante builds sin base de datos se conserva el pie sin estado dinámico.
  }
  const status = STATUS[health?.level ?? 'UNKNOWN'];

  return (
    <footer className="relative mt-16 border-t border-pitch-border/70">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px h-px bg-grad-brand opacity-30" />

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section aria-label="Fuente de los datos" className="fs-panel p-5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-grad-brand font-display text-2xs font-bold text-black">
                F
              </span>
              <p className="font-display text-sm font-bold tracking-tight">
                Fut<span className="fs-gradient-text">Stats</span>
              </p>
            </div>
            <p className="mt-3 text-sm text-pitch-muted">
              Datos proporcionados por{' '}
              <a href="https://www.api-football.com" rel="noopener noreferrer" target="_blank" className="rounded font-medium text-pitch-accent hover:underline">
                API-Football
              </a>
              . Actualización automática cada hora. Algunas competiciones pueden presentar retrasos respecto a la fuente original.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-pitch-muted">
              <Link href="/estado-datos" className="fs-chip transition hover:border-pitch-accent/40 hover:text-white">
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                {status.label}
              </Link>
              {health?.lastSuccessfulSync != null && (
                <time dateTime={health.lastSuccessfulSync}>
                  Última sincronización correcta:{' '}
                  {new Date(health.lastSuccessfulSync).toLocaleString('es-ES', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Europe/Madrid',
                  })}
                </time>
              )}
            </div>
          </section>

          <nav aria-label="Secciones" className="min-w-0">
            <h2 className="fs-eyebrow">Secciones</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {SECTIONS.map((section) => (
                <li key={section.href}>
                  <Link href={section.href} className="block rounded py-1.5 text-pitch-muted transition-colors hover:text-white">
                    {section.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <hr aria-hidden="true" className="fs-rule" />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-pitch-muted">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded py-1 transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-2xs text-pitch-muted md:max-w-sm md:text-right">
            FutStats no está afiliado a la FIFA ni a las ligas mostradas. Escudos y fotografías pertenecen a sus respectivos titulares.
          </p>
        </div>
      </div>
    </footer>
  );
}
