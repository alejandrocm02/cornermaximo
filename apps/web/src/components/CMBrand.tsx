import Link from 'next/link';

export function CMMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="CornerMaximo — Inicio" className="group inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1 focus-visible:ring-2">
      <span aria-hidden="true" className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-white/15 bg-[#0A0D14] font-display text-sm font-black italic tracking-[-.12em] text-white shadow-glow-soft">
        <span className="relative z-10 -translate-x-[1px]">CM</span>
        <span className="absolute -right-2 top-0 h-full w-4 -skew-x-[22deg] bg-pitch-danger/90" />
        <span className="absolute -left-2 bottom-0 h-1/2 w-4 -skew-x-[22deg] bg-pitch-accent/90" />
      </span>
      {!compact && <span className="font-display text-base font-bold tracking-[.04em] text-white sm:text-lg">CORNER<span className="text-pitch-accent">MAXIMO</span></span>}
    </Link>
  );
}
