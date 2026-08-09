import Link from 'next/link';
import type { SimilarPlayersResult } from '@/lib/similarPlayers';

const POSITION_LABEL: Record<string, string> = {
  GK: 'porteros',
  DF: 'defensas',
  MF: 'centrocampistas',
  FW: 'delanteros',
};

export function SimilarPlayers({ result }: { result: SimilarPlayersResult }) {
  if (result.players.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="similar-players-title">
      <div>
        <p className="fs-eyebrow">Scouting</p>
        <h2 id="similar-players-title" className="mt-1 text-2xl font-bold">Jugadores similares</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-pitch-muted">
          Similitud de perfil calculada con métricas por 90 y percentiles frente a {POSITION_LABEL[result.positionGroup] ?? 'jugadores'} de {result.competition ?? 'la misma competición'}. Solo entran jugadores con al menos {result.minimumMinutes} minutos en la muestra.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.players.map((player) => (
          <article key={player.id} className="fs-panel p-4">
            <div className="flex items-center gap-3">
              {player.photoUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.photoUrl} alt="" width={52} height={52} className="h-13 w-13 rounded-full object-cover" />
              ) : (
                <span className="h-[52px] w-[52px] rounded-full bg-pitch-border" />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/jugadores/${player.slug}`} className="font-semibold hover:text-pitch-accent">
                  {player.name}
                </Link>
                <p className="truncate text-xs text-pitch-muted">{player.team ?? 'Sin equipo'} · {player.minutes} min</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-pitch-accent">{player.similarity}%</p>
                <p className="text-[11px] text-pitch-muted">similitud</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-pitch-border" aria-hidden="true">
              <div className="h-full rounded-full bg-pitch-accent" style={{ width: `${player.similarity}%` }} />
            </div>
            <div className="mt-3 flex gap-2">
              <Link href={`/comparador?p1=${player.slug}`} className="fs-btn-ghost inline-flex flex-1 justify-center text-xs">
                Ver ficha
              </Link>
              <Link href={`/comparador?p2=${player.slug}`} className="fs-btn-ghost inline-flex flex-1 justify-center text-xs">
                Comparar
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
