'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CMMark } from './CMBrand';

const PRIMARY = [
  ['/', 'Inicio'], ['/partidos', 'Partidos'], ['/ligas', 'Competiciones'], ['/jugadores', 'Jugadores'], ['/equipos', 'Equipos'], ['/scouting', 'Scouting'], ['/comparador', 'Comparador'], ['/rankings', 'Rankings'], ['/noticias', 'Noticias'],
] as const;
const MORE = [['/fichajes','Fichajes'],['/analizador','Analizador'],['/modo-carrera','Mi Carrera'],['/mundial-2026','Mundial 2026']] as const;
const active = (p:string,h:string) => h === '/' ? p === '/' : p === h || p.startsWith(`${h}/`);

export function MainNav() {
  const pathname = usePathname(); const [open,setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return <nav aria-label="Navegación principal" className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-8">
    <CMMark />
    <ul className="ml-auto hidden items-center gap-0.5 text-sm xl:flex">
      {PRIMARY.map(([href,label]) => <li key={href}><Link href={href} aria-current={active(pathname,href)?'page':undefined} className={`relative block rounded-lg px-2.5 py-2 transition ${active(pathname,href)?'font-semibold text-white':'text-pitch-muted hover:bg-pitch-elevated hover:text-white'}`}>{label}{active(pathname,href)&&<span className="absolute inset-x-2 -bottom-px h-0.5 bg-pitch-accent" />}</Link></li>)}
    </ul>
    <Link href="/cuenta" className="hidden min-h-11 items-center rounded-lg border border-pitch-border px-3 text-sm font-semibold text-pitch-subtle hover:border-pitch-accent/50 hover:text-white md:inline-flex">Mi Corner</Link>
    <button type="button" aria-expanded={open} aria-controls="cm-menu" aria-label={open?'Cerrar menú':'Abrir menú'} onClick={()=>setOpen(v=>!v)} className="grid h-11 w-11 place-items-center rounded-lg border border-pitch-border bg-pitch-card text-white xl:hidden"><span aria-hidden="true">{open?'×':'☰'}</span></button>
    {open && <div id="cm-menu" className="absolute inset-x-0 top-16 z-50 border-b border-pitch-border bg-pitch-bg/98 p-4 shadow-float backdrop-blur-xl xl:hidden">
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-3">
        {[...PRIMARY,...MORE].map(([href,label]) => <Link key={href} href={href} className={`flex min-h-11 items-center rounded-lg border px-3 text-sm ${active(pathname,href)?'border-pitch-accent/50 bg-pitch-accent/10 text-white':'border-pitch-border bg-pitch-card text-pitch-subtle'}`}>{label}</Link>)}
      </div>
    </div>}
  </nav>;
}
