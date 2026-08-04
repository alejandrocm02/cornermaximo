'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/noticias', label: 'Noticias' },
  { href: '/fichajes', label: 'Fichajes' },
  { href: '/analizador', label: 'Analizador' },
  { href: '/modo-carrera', label: 'Mi Carrera' },
  { href: '/mundial-2026', label: 'Mundial 2026' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase = 'rounded-lg outline-none transition-colors duration-150';

export function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const html = document.documentElement;
    const previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: document.body.style.overflow,
    };
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    panelRef.current?.querySelector<HTMLElement>('button, a')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === 'Tab' && panelRef.current != null) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('a, button');
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      html.style.overflow = previous.htmlOverflow;
      document.body.style.overflow = previous.bodyOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <nav
      aria-label="Navegación principal"
      className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8"
    >
      <Link href="/" className={`group flex shrink-0 items-center gap-2.5 ${linkBase} p-1`}>
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-xl bg-grad-brand font-display text-sm font-bold text-black shadow-glow-soft transition-transform duration-200 group-hover:scale-105"
        >
          F
        </span>
        <span className="font-display text-lg font-bold tracking-tight">
          Fut<span className="fs-gradient-text">Stats</span>
        </span>
      </Link>

      <ul className="hidden flex-1 items-center justify-end gap-0.5 text-sm lg:flex">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`${linkBase} relative block px-3 py-2 ${
                  active ? 'font-semibold text-white' : 'text-pitch-muted hover:bg-pitch-elevated/60 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-grad-brand shadow-glow-soft"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((value) => !value)}
        className={`ml-auto grid h-11 w-11 place-items-center border border-pitch-border bg-pitch-card/60 text-pitch-subtle transition hover:border-pitch-accent/50 hover:text-white lg:hidden ${linkBase}`}
      >
        {open ? (
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l12 12M16 4L4 16" strokeLinecap="round" />
          </svg>
        ) : (
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            id="menu-movil"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="fixed inset-x-0 top-0 z-50 h-[100dvh] overflow-y-auto overscroll-contain bg-pitch-bg lg:hidden"
          >
            <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-pitch-border bg-pitch-bg px-4">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  requestAnimationFrame(() => buttonRef.current?.focus());
                }}
                className={`${linkBase} inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold text-pitch-subtle hover:bg-pitch-elevated hover:text-white`}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M16 10H4m5-5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Volver
              </button>
              <span className="text-sm font-semibold text-white">Menú</span>
            </div>
            <ul className="mx-auto grid max-w-md gap-1.5 p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-[3rem] items-center justify-between rounded-xl border px-4 py-3 text-base outline-none transition ${
                        active
                          ? 'border-pitch-accent/50 bg-pitch-accent/10 font-semibold text-white shadow-glow-soft'
                          : 'border-pitch-border bg-pitch-card/60 text-pitch-subtle hover:border-pitch-border-strong hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className={`h-5 w-1 rounded-full ${active ? 'bg-grad-brand' : 'bg-transparent'}`}
                        />
                        {item.label}
                      </span>
                      {active ? (
                        <span className="fs-chip border-pitch-accent/40 bg-pitch-accent/10 text-pitch-accent">
                          Estás aquí
                        </span>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-pitch-muted"
                        >
                          <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body,
        )}
    </nav>
  );
}
