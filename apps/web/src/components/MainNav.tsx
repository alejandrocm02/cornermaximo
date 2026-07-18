'use client';

/**
 * Navegación principal accesible.
 * - Estado activo según la ruta.
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
  { href: '/mundial-2026', label: 'Mundial 2026' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const linkBase =
  'rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-bg';

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
    <nav aria-label="Navegación principal" className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
      <Link href="/" className={`text-lg font-bold tracking-tight ${linkBase}`}>
        Fut<span className="text-pitch-accent">Stats</span>
      </Link>

      {/* Escritorio */}
      <div className="hidden gap-1 text-sm md:flex">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`${linkBase} ${
                active ? 'bg-pitch-accent/15 font-medium text-pitch-accent' : 'text-pitch-muted hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Móvil */}
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={open}
        aria-controls="menu-movil"
        onClick={() => setOpen((o) => !o)}
        className={`ml-auto md:hidden ${linkBase} p-2 text-pitch-muted hover:text-white`}
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
          className="fixed inset-0 top-[53px] z-40 overflow-y-auto bg-pitch-bg/98 p-4 backdrop-blur md:hidden"
        >
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-lg px-4 py-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent ${
                      active ? 'bg-pitch-accent/15 font-medium text-pitch-accent' : 'text-white hover:bg-pitch-border/40'
                    }`}
                  >
                    {item.label}
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
