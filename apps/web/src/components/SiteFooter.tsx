import { prisma } from '@futstats/db';
import Link from 'next/link';

/** Pie de página con bloque de confianza (fuente, frecuencia y última actualización reales). */
export async function SiteFooter() {
  let updatedAt: Date | null = null;
  try {
    const agg = await prisma.playerMatchStatistics.aggregate({ _max: { syncedAt: true } });
    updatedAt = agg._max.syncedAt;
  } catch {
    // sin conexión a BD (p.ej. durante el build): se omite la fecha
  }

  return (
    <footer className="border-t border-pitch-border">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <section aria-label="Fuente de los datos" className="rounded-xl border border-pitch-border bg-pitch-card p-4 text-sm text-pitch-muted">
          <p>
            Datos proporcionados por{' '}
            <a href="https://www.api-football.com" rel="noopener noreferrer" target="_blank" className="text-pitch-accent hover:underline">
              API-Football
            </a>
            . Actualización automática cada hora. Algunas competiciones pueden presentar retrasos
            respecto a la fuente original.
          </p>
          {updatedAt != null && (
            <p className="mt-1">
              Última actualización de estadísticas:{' '}
              {updatedAt.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
            </p>
          )}
        </section>
        <nav aria-label="Enlaces del pie" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-pitch-muted">
          <Link href="/sobre" className="rounded py-1 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">Sobre FutStats</Link>
          <Link href="/metodologia" className="rounded py-1 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">Fuente y metodología</Link>
          <Link href="/privacidad" className="rounded py-1 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">Política de privacidad</Link>
          <Link href="/aviso-legal" className="rounded py-1 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent">Aviso legal</Link>
        </nav>
        <p className="text-xs text-pitch-muted">
          FutStats no está afiliado a la FIFA ni a las ligas mostradas. Escudos y fotografías
          pertenecen a sus respectivos titulares.
        </p>
      </div>
    </footer>
  );
}
