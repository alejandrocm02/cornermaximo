'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type IconName = 'home' | 'match' | 'intel' | 'search' | 'corner';

const items: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/', label: 'Inicio', icon: 'home' },
  { href: '/partidos', label: 'Partidos', icon: 'match' },
  { href: '/intelligence', label: 'Intelligence', icon: 'intel' },
  { href: '/jugadores', label: 'Buscar', icon: 'search' },
  { href: '/mi-corner', label: 'Mi Corner', icon: 'corner' },
];

function Icon({ name }: { name: IconName }) {
  const common = 'h-[21px] w-[21px] fill-none stroke-current';
  if (name === 'home') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="m4 11 8-7 8 7v9H7v-6h10v6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (name === 'match') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === 'intel') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="m12 3 8 9-8 9-8-9 8-9Z"/><path d="m12 7 4.5 5-4.5 5-4.5-5 4.5-5Z"/></svg>;
  if (name === 'search') return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5" strokeLinecap="round"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8"><path d="M12 3 21 12 12 21 3 12 12 3Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#05080d]/95 px-[max(.35rem,env(safe-area-inset-left))] pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_45px_-25px_rgba(0,0,0,.95)] backdrop-blur-2xl md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon }) => {
          const selected = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={selected ? 'page' : undefined}
                className={`relative flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${selected ? 'text-pitch-accent' : 'text-pitch-muted active:bg-white/5'}`}
              >
                {selected && <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 rounded-full bg-pitch-accent shadow-[0_0_14px_rgba(44,132,255,.8)]" />}
                <span className={`grid h-8 w-8 place-items-center rounded-xl transition ${selected ? 'bg-pitch-accent/10' : ''}`}><Icon name={icon} /></span>
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
