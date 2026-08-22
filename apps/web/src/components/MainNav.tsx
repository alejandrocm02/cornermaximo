'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CMMark } from './CMBrand';

const PRIMARY = [
  ['/', 'Inicio'],
  ['/partidos', 'Partidos'],
  ['/ligas', 'Competiciones'],
  ['/jugadores', 'Jugadores'],
  ['/equipos', 'Equipos'],
  ['/intelligence', 'Intelligence'],
  ['/scouting', 'Scouting'],
  ['/noticias', 'Noticias'],
] as const;

const MORE = [
  ['/comparador', 'Comparador'],
  ['/rankings', 'Rankings'],
  ['/fichajes', 'Fichajes'],
  ['/analizador', 'Analizador'],
  ['/modo-carrera', 'Mi Carrera'],
  ['/mundial-2026', 'Mundial 2026'],
  ['/pro', 'CornerMaximo Pro'],
] as const;

const active = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

export function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const mobileMenu = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          id="cm-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-x-0 bottom-0 top-16 z-[100] overflow-y-auto overscroll-contain border-t border-pitch-border bg-pitch-bg px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 xl:hidden"
        >
          <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {[...PRIMARY, ...MORE].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active(pathname, href) ? 'page' : undefined}
                className={`flex min-h-12 items-center rounded-xl border px-4 text-sm transition ${
                  active(pathname, href)
                    ? 'border-pitch-accent/60 bg-pitch-accent/10 font-semibold text-white'
                    : 'border-pitch-border bg-pitch-card text-pitch-subtle hover:border-pitch-accent/40 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/mi-corner"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl border border-pitch-accent/50 bg-pitch-accent/10 px-4 text-sm font-semibold text-white"
            >
              Mi Corner
            </Link>
            <Link
              href="/cuenta"
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center rounded-xl border border-pitch-border bg-pitch-card px-4 text-sm text-pitch-subtle hover:border-pitch-accent/40 hover:text-white"
            >
              Perfil
            </Link>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <nav
      aria-label="Navegación principal"
      className="relative mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8"
    >
      <CMMark />

      <ul className="ml-auto hidden items-center gap-0.5 text-sm xl:flex">
        {PRIMARY.map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active(pathname, href) ? 'page' : undefined}
              className={`relative block rounded-lg px-2.5 py-2 transition ${
                active(pathname, href)
                  ? 'font-semibold text-white'
                  : 'text-pitch-muted hover:bg-pitch-elevated hover:text-white'
              }`}
            >
              {label}
              {active(pathname, href) && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 bg-pitch-accent" />
              )}
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/mi-corner"
        className="hidden min-h-11 items-center rounded-lg border border-pitch-border px-3 text-sm font-semibold text-pitch-subtle hover:border-pitch-accent/50 hover:text-white md:inline-flex"
      >
        Mi Corner
      </Link>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="cm-menu"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((value) => !value)}
        className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-pitch-border bg-pitch-card text-xl text-white xl:hidden"
      >
        <span aria-hidden="true">{open ? '×' : '☰'}</span>
      </button>

      {mobileMenu}
    </nav>
  );
}
