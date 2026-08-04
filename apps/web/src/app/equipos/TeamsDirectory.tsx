'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface TeamDirectoryItem {
  slug: string;
  name: string;
  shortName: string | null;
  crestUrl: string | null;
  country: string;
  isNational: boolean;
  playerCount: number;
  competitions: Array<{ slug: string; name: string }>;
}

interface TeamsDirectoryProps {
  teams: TeamDirectoryItem[];
}

function normalized(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase();
}

export function TeamsDirectory({ teams }: TeamsDirectoryProps) {
  const [query, setQuery] = useState('');
  const [competition, setCompetition] = useState('all');
  const [kind, setKind] = useState<'all' | 'club' | 'national'>('all');

  const competitions = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const team of teams) {
      for (const item of team.competitions) bySlug.set(item.slug, item.name);
    }
    return [...bySlug.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [teams]);

  const filtered = useMemo(() => {
    const needle = normalized(query);
    return teams.filter((team) => {
      if (kind === 'club' && team.isNational) return false;
      if (kind === 'national' && !team.isNational) return false;
      if (
        competition !== 'all' &&
        !team.competitions.some((item) => item.slug === competition)
      ) {
        return false;
      }
      if (needle === '') return true;

      const haystack = normalized(
        [
          team.name,
          team.shortName ?? '',
          team.country,
          ...team.competitions.map((item) => item.name),
        ].join(' '),
      );
      return haystack.includes(needle);
    });
  }, [competition, kind, query, teams]);

  function resetFilters() {
    setQuery('');
    setCompetition('all');
    setKind('all');
  }

  return (
    <section aria-labelledby="teams-directory-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="fs-eyebrow">Explorar</p>
          <h2 id="teams-directory-title" className="mt-1 text-2xl font-bold">
            Directorio de equipos
          </h2>
        </div>
        <p aria-live="polite" className="fs-chip">
          {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </p>
      </div>

      <div className="fs-panel grid gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(12rem,1fr)_minmax(10rem,0.7fr)]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-pitch-subtle">Buscar equipo</span>
          <span className="relative block">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pitch-muted"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Nombre, país o competición"
              className="fs-input pl-10"
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-pitch-subtle">Competición</span>
          <select
            value={competition}
            onChange={(event) => setCompetition(event.target.value)}
            className="fs-input"
          >
            <option value="all">Todas las competiciones</option>
            {competitions.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-pitch-subtle">Tipo</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="fs-input"
          >
            <option value="all">Clubes y selecciones</option>
            <option value="club">Solo clubes</option>
            <option value="national">Solo selecciones</option>
          </select>
        </label>
      </div>

      {filtered.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => (
            <li key={team.slug}>
              <Link
                href={`/equipos/${team.slug}`}
                className="fs-panel-interactive group flex h-full min-h-36 flex-col p-4"
              >
                <span className="flex items-start gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-pitch-border bg-white/95 p-1.5">
                    {team.crestUrl != null ? (
                      <Image
                        src={team.crestUrl}
                        alt={`Escudo de ${team.name}`}
                        width={48}
                        height={48}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="font-display text-sm font-bold text-pitch-bg">
                        {initials(team.name)}
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-bold text-white">
                      {team.name}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-pitch-muted">
                      <span>{team.country}</span>
                      <span aria-hidden="true">·</span>
                      <span>{team.isNational ? 'Selección' : 'Club'}</span>
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="mt-1 text-pitch-muted transition group-hover:translate-x-0.5 group-hover:text-pitch-accent"
                  >
                    →
                  </span>
                </span>

                <span className="mt-4 flex flex-wrap gap-1.5">
                  {team.competitions.slice(0, 2).map((item) => (
                    <span key={item.slug} className="fs-chip max-w-full truncate">
                      {item.name}
                    </span>
                  ))}
                  {team.competitions.length > 2 && (
                    <span className="fs-chip">+{team.competitions.length - 2}</span>
                  )}
                </span>

                <span className="mt-auto pt-4 text-2xs text-pitch-muted">
                  {team.playerCount} {team.playerCount === 1 ? 'jugador registrado' : 'jugadores registrados'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="fs-panel px-5 py-12 text-center">
          <p className="font-display text-lg font-semibold text-white">No hay coincidencias</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-pitch-muted">
            Prueba con otro nombre o elimina alguno de los filtros activos.
          </p>
          <button type="button" onClick={resetFilters} className="fs-btn-ghost mt-5">
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  );
}
