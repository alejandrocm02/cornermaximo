'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CMMark } from './CMBrand';

type NavRoute = readonly [href: string, label: string];
type NavGroup = { label: string; routes: readonly NavRoute[] };

const GROUPS: readonly NavGroup[] = [
  {
    label: 'Fútbol',
    routes: [
      ['/', 'Inicio'],
      ['/partidos', 'Partidos'],
      ['/ligas', 'Competiciones'],
      ['/equipos', 'Equipos'],
      ['/jugadores', 'Jugadores'],
      ['/rankings', 'Rankings'],
    ],
  },
  {
    label: 'Intelligence',
    routes: [
      ['/intelligence', 'Intelligence Hub'],
      ['/scouting', 'CM Scout'],
      ['/comparador', 'Comparador'],
      ['/analizador', 'Analizador'],
      ['/modo-carrera', 'Mi Carrera'],
    ],
  },
  {
    label: 'Actualidad',
    routes: [
      ['/noticias', 'Noticias'],
      ['/fichajes', 'Fichajes'],
      ['/mundial-2026', 'Mundial 2026'],
    ],
  },
] as const;

const active = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

const groupActive = (pathname: string, routes: readonly NavRoute[]) =>
  routes.some(([href]) => active(pathname, href));

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-none stroke-current" strokeWidth="1.8">
      <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
          className="fixed inset-x-0 bottom-0 top-16 z-[100] overflow-y-auto overscroll-contain border-t border-pitch-border bg-[#060910] px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-5 xl:hidden"
        >
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {GROUPS.map((group) => (
              <section key={group.label}>
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pitch-muted">{group.label}</p>
                <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
                  {group.routes.map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active(pathname, href) ? 'page' : undefined}
                      className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm transition ${
                        active(pathname, href)
                          ? 'border-pitch-accent/60 bg-pitch-accent/12 font-semibold text-white shadow-glow-soft'
                          : 'border-pitch-border bg-pitch-card/75 text-pitch-subtle hover:border-pitch-accent/40 hover:text-white'
                      }`}
                    >
                      {label}<span aria-hidden="true" className="text-pitch-muted">→</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
            <section className="grid gap-2 min-[360px]:grid-cols-2">
              <Link href="/pro" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl border border-pitch-danger/35 bg-pitch-danger/10 px-4 text-sm font-semibold text-white">
                CornerMaximo Premium
              </Link>
              <Link href="/mi-corner" onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl border border-pitch-accent/50 bg-pitch-accent/10 px-4 text-sm font-semibold text-white">
                Mi Corner
              </Link>
            </section>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <nav aria-label="Navegación principal" className="relative mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
      <CMMark />

      <ul className="ml-auto hidden items-center gap-1 xl:flex">
        {GROUPS.map((group) => {
          const selected = groupActive(pathname, group.routes);
          return (
            <li key={group.label} className="group relative">
              <button
                type="button"
                className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition ${selected ? 'bg-pitch-elevated/70 text-white' : 'text-pitch-muted hover:bg-pitch-elevated/55 hover:text-white'}`}
              >
                {group.label}<Chevron />
              </button>
              <div className="cm-nav-dropdown" aria-label={`Menú ${group.label}`}>
                <p className="px-3 pb-2 pt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-pitch-muted">{group.label}</p>
                {group.routes.map(([href, label]) => (
                  <Link key={href} href={href} aria-current={active(pathname, href) ? 'page' : undefined} className={active(pathname, href) ? '!bg-pitch-accent/10 !text-white' : undefined}>
                    <span className="flex-1">{label}</span>{active(pathname, href) && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-pitch-accent" />}
                  </Link>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <Link href="/pro" className="hidden min-h-10 items-center rounded-xl border border-pitch-danger/25 bg-pitch-danger/5 px-3 text-xs font-semibold text-pitch-subtle transition hover:border-pitch-danger/50 hover:text-white xl:inline-flex">
        Premium
      </Link>
      <Link href="/mi-corner" className="hidden min-h-10 items-center rounded-xl border border-pitch-border bg-pitch-card/60 px-3 text-sm font-semibold text-pitch-subtle transition hover:border-pitch-accent/50 hover:text-white md:inline-flex">
        Mi Corner
      </Link>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="cm-menu"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((value) => !value)}
        className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-pitch-border bg-pitch-card/80 text-white shadow-panel xl:hidden"
      >
        {open ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" /></svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2"><path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" /></svg>
        )}
      </button>

      {mobileMenu}
    </nav>
  );
}
