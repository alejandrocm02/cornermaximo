'use client';

/**
 * Navegación principal accesible.
 * - Estado activo según la ruta, señalado con color + peso + barra inferior
 *   (nunca solo con color, para no depender de la percepción cromática).
 * - Escritorio a partir de `lg`: con diez secciones, en tablet el menú
 *   desplegable resulta más legible que una fila comprimida.
 * - Menú móvil: botón con etiqueta accesible, cierre con Escape, foco visible,
 *   bloqueo de scroll del body mientras está abierto y trampa de foco básica.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const NAV = [
  { href: '/', label: 'Inicio' },
  { href: '/jugadores', label: 'Jugadores' },
  { href: '/ligas', label: 'Ligas' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/comparador', label: 'Comparador' },
  { href: '/noticias', label: 'Noticias' },
  { href: '/fichajes', label: 'Fichajes' },
  { href: '/apuestas', label: 'Apuestas' },
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cerrar al navegar
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape + bloqueo de scroll + foco inicial dentro del panel
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key === 'Tab' && panelRef.current != null) {
        // Trampa de foco: mantener el tabulador dentro del menú abierto
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('a, button');
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <nav
      aria-label="Navegación principal"
      className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:gap-6 lg:px-8"
    >
      <Link href="/" className={`group flex shrink-0 items-center gap-2.5 ${linkBase} p-1`}>
        {/* Marca: monograma con degradado + halo. */}
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

      {/* Escritorio */}
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

      {/* Móvil y tablet */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <div
          id="menu-movil"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 top-16 z-40 overflow-y-auto bg-pitch-bg/95 p-4 backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid max-w-md gap-1.5 pb-8">
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
                    {item.label}
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={active ? 'text-pitch-accent' : 'text-pitch-muted'}
                    >
                      <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
