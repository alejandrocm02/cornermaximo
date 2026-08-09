'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/', 'Inicio', '⌂'], ['/partidos', 'Partidos', '◷'], ['/buscar', 'Buscar', '⌕'], ['/cuenta', 'Mi Corner', '◇'], ['/cuenta', 'Perfil', '○'],
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  return <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 border-t border-pitch-border bg-pitch-bg/95 px-[max(.5rem,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
    <ul className="mx-auto grid max-w-lg grid-cols-5">
      {items.map(([href,label,icon], index) => {
        const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
        return <li key={`${label}-${index}`}><Link href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-semibold transition ${active ? 'text-pitch-accent' : 'text-pitch-muted'}`}>
          <span aria-hidden="true" className="text-xl leading-none">{icon}</span><span>{label}</span>
        </Link></li>;
      })}
    </ul>
  </nav>;
}
