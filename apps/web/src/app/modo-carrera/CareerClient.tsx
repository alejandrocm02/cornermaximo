'use client';

/**
 * Mi Carrera — juego narrativo local de carrera futbolística.
 * Sin peticiones remotas: simulación determinista con semilla y guardado
 * automático en localStorage tras cada evento.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { START_COUNTRIES } from '@/lib/career/data';
import { countryFlag, countryName } from '@/lib/career/countries';
import { CountrySelect } from './CountrySelect';
import {
  buildCareerCard,
  continueFromResult,
  createCareer,
  overall,
  playJornada,
  resolveEvent,
  resolveMoment,
  resolveOffer,
  retireNow,
  setTraining,
  simulateBlock,
  startNextSeason,
  suggestName,
  type MatchApproach,
} from '@/lib/career/engine';
import { addToRanking, deleteCareer, loadCareers, loadRanking, saveCareer, track } from '@/lib/career/storage';
import {
  ARCHETYPE_LABELS,
  DIFFICULTY_LABELS,
  FIELD_ATTR_LABELS,
  GK_ATTR_LABELS,
  POSITION_LABELS,
  RISK_LABELS,
  TRAINING_LABELS,
  type Archetype,
  type CareerCard,
  type CareerState,
  type Difficulty,
  type FieldAttr,
  type Foot,
  type GkAttr,
  type Position,
  type TrainingFocus,
} from '@/lib/career/types';

type View = 'inicio' | 'crear' | 'juego' | 'ranking';

const POSITIONS = Object.keys(POSITION_LABELS) as Position[];
const ARCHETYPES = Object.keys(ARCHETYPE_LABELS) as Archetype[];
const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];
const TRAININGS = Object.keys(TRAINING_LABELS) as TrainingFocus[];

const btnPrimary =
  'rounded-lg bg-pitch-accent px-4 py-3 font-medium text-black outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50';
const btnSecondary =
  'rounded-lg border border-pitch-border px-4 py-3 text-sm text-pitch-muted outline-none hover:border-pitch-accent hover:text-white focus-visible:ring-2 focus-visible:ring-pitch-accent';
const card = 'fs-panel p-4';

function StatBar({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const color = tone === 'warn' || value < 35 ? 'bg-pitch-danger' : value < 60 ? 'bg-yellow-400' : 'bg-pitch-accent';
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-pitch-muted">{label}</span>
        <span className="font-medium">{Math.round(value)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-pitch-border" role="img" aria-label={`${label}: ${Math.round(value)} de 100`}>
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.max(3, value)}%` }} />
      </div>
    </div>
  );
}

function percentileLine(state: CareerState): string | null {
  const s = state.stats;
  const pos = state.player.position;
  if (s.pj < 5) return null;
  if (pos === 'POR') {
    const pct = Math.min(97, Math.round((s.porteriasCero / Math.max(1, s.pj)) * 220));
    return `Tu portero dejó la portería a cero en más partidos que el ${pct} % de los porteros simulados de su nivel.`;
  }
  if (pos === 'DEL' || pos === 'EXT' || pos === 'MCO') {
    const pct = Math.min(98, Math.round((s.goles / Math.max(1, s.pj)) * 170));
    return `Tu ${POSITION_LABELS[pos].toLowerCase()} marcó más goles que el ${pct} % de los jugadores de su posición en esta simulación.`;
  }
  const avg = s.ratingCount > 0 ? s.ratingSum / s.ratingCount : 0;
  if (avg <= 0) return null;
  const pct = Math.min(97, Math.max(3, Math.round((avg - 5.5) * 55)));
  return `Tu valoración media supera al ${pct} % de los jugadores simulados de su posición.`;
}

export function CareerClient() {
  const [view, setView] = useState<View>('inicio');
  const [career, setCareer] = useState<CareerState | null>(null);
  const [saved, setSaved] = useState<CareerState[]>([]);
  const [ranking, setRanking] = useState<CareerCard[]>([]);
  const [copied, setCopied] = useState(false);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const rankedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSaved(loadCareers());
    setRanking(loadRanking());
  }, []);

  const apply = useCallback((next: CareerState) => {
    setCareer(next);
    saveCareer(next);
    setSaved(loadCareers());
  }, []);

  // Al terminar una carrera, se añade una única vez al ranking local.
  useEffect(() => {
    if (career == null || !career.retired || career.screen.type !== 'finCarrera') return;
    if (rankedIds.current.has(career.id)) return;
    rankedIds.current.add(career.id);
    const cardData = buildCareerCard(career);
    setRanking(addToRanking(cardData));
    track('fin_carrera', { posicion: career.player.position, temporadas: cardData.seasons, puntuacion: cardData.score, dificultad: career.difficulty });
  }, [career]);

  const startCreate = () => {
    setView('crear');
  };

  const continueCareer = (c: CareerState) => {
    setCareer(c);
    setView('juego');
  };

  const onCreated = (c: CareerState) => {
    track('inicio_carrera', { posicion: c.player.position, dificultad: c.difficulty });
    apply(c);
    setView('juego');
  };

  const removeCareer = (id: string) => {
    deleteCareer(id);
    setSaved(loadCareers());
    if (career?.id === id) {
      setCareer(null);
      setView('inicio');
    }
  };

  const shareCard = async (cardData: CareerCard) => {
    const text = [
      `Mi Carrera en FutStats — ${cardData.name} (${POSITION_LABELS[cardData.position]}, ${cardData.countryName})`,
      `${cardData.seasons} temporadas · ${cardData.pj} partidos · ${cardData.goles} goles · ${cardData.asistencias} asistencias`,
      `Títulos: ${cardData.titles.length > 0 ? cardData.titles.join(', ') : 'ninguno'}`,
      `Selección: ${cardData.caps} internacionalidades`,
      `Puntuación: ${cardData.score} · Nivel: ${cardData.legendLevel}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      track('compartir_resumen');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // El portapapeles puede estar bloqueado: no es un error crítico.
    }
  };

  return (
    <div className="space-y-6">
      <p ref={liveRef} aria-live="polite" className="sr-only" />
      {view === 'inicio' && (
        <HomeView
          saved={saved}
          onStart={startCreate}
          onContinue={continueCareer}
          onDelete={removeCareer}
          onRanking={() => setView('ranking')}
        />
      )}
      {view === 'crear' && <CreateView onCancel={() => setView('inicio')} onCreated={onCreated} />}
      {view === 'juego' && career != null && (
        <GameView
          career={career}
          apply={apply}
          onExit={() => setView('inicio')}
          onShare={shareCard}
          copied={copied}
          onDelete={removeCareer}
        />
      )}
      {view === 'ranking' && <RankingView ranking={ranking} onBack={() => setView('inicio')} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pantalla de inicio
// ---------------------------------------------------------------------------

function HomeView({
  saved,
  onStart,
  onContinue,
  onDelete,
  onRanking,
}: {
  saved: CareerState[];
  onStart: () => void;
  onContinue: (c: CareerState) => void;
  onDelete: (id: string) => void;
  onRanking: () => void;
}) {
  return (
    <div className="space-y-6">
      <section className={`${card} space-y-3 p-6`}>
        <h2 className="text-xl font-bold sm:text-2xl">Crea tu futbolista. Construye su leyenda.</h2>
        <p className="max-w-2xl text-sm text-pitch-muted">
          Empieza con 16 años, gana minutos, toma decisiones y conviértete en una estrella del fútbol.
        </p>
        <p className="max-w-2xl text-xs text-pitch-muted">
          Cada decisión puede cambiar tu futuro: minutos, contratos, lesiones, títulos y selección.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="button" onClick={onStart} className={btnPrimary}>
            Empezar carrera
          </button>
          {saved.length > 0 ? (
            <button type="button" onClick={() => onContinue(saved[0]!)} className={btnSecondary}>
              Continuar partida
            </button>
          ) : null}
          <button type="button" onClick={onRanking} className={btnSecondary}>
            Ranking local
          </button>
        </div>
        {saved.length === 0 && <p className="text-xs text-pitch-muted">Todavía no has comenzado tu carrera.</p>}
      </section>

      {saved.length > 0 && (
        <section aria-label="Carreras guardadas" className="space-y-2">
          <h3 className="text-sm font-bold text-pitch-muted">Carreras guardadas</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {saved.map((c) => (
              <li key={c.id} className={`${card} flex items-center justify-between gap-3`}>
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{c.player.name}</p>
                  <p className="text-xs text-pitch-muted">
                    {POSITION_LABELS[c.player.position]} · {c.player.age} años · {c.club.name}
                    {c.retired ? ' · Retirado' : ` · Temporada ${c.year}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => onContinue(c)} className={`${btnSecondary} px-3 py-2`}>
                    {c.retired ? 'Ver resumen' : 'Continuar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Eliminar la carrera de ${c.player.name}`}
                    className={`${btnSecondary} px-3 py-2 hover:border-pitch-danger hover:text-pitch-danger`}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-pitch-muted">
        La partida se guarda automáticamente y únicamente en este dispositivo (almacenamiento local del navegador). Todos los
        clubes y ligas del modo son ficticios.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creación del futbolista
// ---------------------------------------------------------------------------

function CreateView({ onCancel, onCreated }: { onCancel: () => void; onCreated: (c: CareerState) => void }) {
  const [name, setName] = useState('');
  const [primaryCode, setPrimaryCode] = useState<string | null>('ES');
  const [secondaryCode, setSecondaryCode] = useState<string | null>(null);
  const [age, setAge] = useState(16);
  const [position, setPosition] = useState<Position>('DEL');
  const [foot, setFoot] = useState<Foot>('derecho');
  const [heightCm, setHeightCm] = useState(178);
  const [archetype, setArchetype] = useState<Archetype>('goleador');
  const [startCountry, setStartCountry] = useState('ESP');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seedText, setSeedText] = useState('');

  const archetypeOptions = useMemo(
    () => (position === 'POR' ? (['reflejos', 'completo'] as Archetype[]) : ARCHETYPES.filter((a) => a !== 'reflejos')),
    [position],
  );

  useEffect(() => {
    if (!archetypeOptions.includes(archetype)) setArchetype(archetypeOptions[0]!);
  }, [archetypeOptions, archetype]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (primaryCode == null) return;
    onCreated(
      createCareer({
        name,
        primaryNationalityCode: primaryCode,
        secondaryNationalityCode: secondaryCode != null && secondaryCode !== primaryCode ? secondaryCode : null,
        age,
        position,
        foot,
        heightCm,
        archetype,
        startCountry,
        difficulty,
        seedText: seedText !== '' ? seedText : null,
      }),
    );
  };

  const field = 'flex flex-col gap-1 text-sm';
  const input = 'rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent';

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className={`${card} space-y-4`}>
        <h2 className="text-lg font-bold">Crea tu futbolista</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={field}>
            <span className="text-xs text-pitch-muted">Nombre del futbolista</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre futbolístico"
                className={`${input} w-full`}
              />
              <button type="button" onClick={() => setName(suggestName())} className={`${btnSecondary} shrink-0 px-3 py-2`}>
                Sugerir
              </button>
            </div>
          </label>
          <CountrySelect label="Nacionalidad" value={primaryCode} onChange={setPrimaryCode} />
          <CountrySelect
            label="Segunda nacionalidad (opcional)"
            value={secondaryCode}
            onChange={setSecondaryCode}
            allowEmpty
            emptyLabel="Ninguna"
            excludeCode={primaryCode}
          />
          <label className={field}>
            <span className="text-xs text-pitch-muted">Edad inicial (16 recomendada)</span>
            <select value={age} onChange={(e) => setAge(Number(e.target.value))} className={input}>
              {[16, 17, 18, 19].map((a) => (
                <option key={a} value={a}>
                  {a} años
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className="text-xs text-pitch-muted">Posición</span>
            <select value={position} onChange={(e) => setPosition(e.target.value as Position)} className={input}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
          <label className={field}>
            <span className="text-xs text-pitch-muted">Pie dominante</span>
            <select value={foot} onChange={(e) => setFoot(e.target.value as Foot)} className={input}>
              <option value="derecho">Derecho</option>
              <option value="izquierdo">Izquierdo</option>
              <option value="ambidiestro">Ambidiestro</option>
            </select>
          </label>
          <label className={field}>
            <span className="text-xs text-pitch-muted">Altura: {heightCm} cm</span>
            <input
              type="range"
              min={160}
              max={200}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              aria-label={`Altura en centímetros: ${heightCm}`}
            />
          </label>
          <label className={field}>
            <span className="text-xs text-pitch-muted">País de inicio</span>
            <select value={startCountry} onChange={(e) => setStartCountry(e.target.value)} className={input}>
              {START_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)} (segunda división)
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <fieldset className={`${card} space-y-3`}>
        <legend className="px-1 text-sm font-bold">Tipo de jugador</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {archetypeOptions.map((a) => (
            <label
              key={a}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                archetype === a ? 'border-pitch-accent bg-pitch-accent/10' : 'border-pitch-border'
              }`}
            >
              <input
                type="radio"
                name="arquetipo"
                value={a}
                checked={archetype === a}
                onChange={() => setArchetype(a)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{ARCHETYPE_LABELS[a].label}</span>
                <span className="block text-xs text-pitch-muted">{ARCHETYPE_LABELS[a].desc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={`${card} space-y-3`}>
        <legend className="px-1 text-sm font-bold">Dificultad</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DIFFICULTIES.map((d) => (
            <label
              key={d}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                difficulty === d ? 'border-pitch-accent bg-pitch-accent/10' : 'border-pitch-border'
              }`}
            >
              <input type="radio" name="dificultad" value={d} checked={difficulty === d} onChange={() => setDifficulty(d)} className="mt-1" />
              <span>
                <span className="font-medium">{DIFFICULTY_LABELS[d].label}</span>
                <span className="block text-xs text-pitch-muted">{DIFFICULTY_LABELS[d].desc}</span>
              </span>
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Semilla de partida (opcional): la misma semilla genera la misma carrera</span>
          <input
            type="text"
            value={seedText}
            maxLength={40}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="Por ejemplo: reto-semanal-31"
            className={input}
          />
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={primaryCode == null} className={btnPrimary}>
          Empezar carrera
        </button>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Volver
        </button>
      </div>
      {primaryCode == null && <p className="text-xs text-pitch-danger">Elige una nacionalidad para empezar.</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Juego
// ---------------------------------------------------------------------------

function GameView({
  career,
  apply,
  onExit,
  onShare,
  copied,
  onDelete,
}: {
  career: CareerState;
  apply: (c: CareerState) => void;
  onExit: () => void;
  onShare: (card: CareerCard) => void;
  copied: boolean;
  onDelete: (id: string) => void;
}) {
  const p = career.player;
  const screen = career.screen;
  const avg = career.stats.ratingCount > 0 ? career.stats.ratingSum / career.stats.ratingCount : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        {/* Contexto de temporada */}
        <section className={`${card} flex flex-wrap items-center justify-between gap-3 text-sm`}>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">
              <span aria-hidden="true">{countryFlag(p.primaryNationalityCode)}</span> {p.name} ·{' '}
              {POSITION_LABELS[p.position]} · {p.age} años
              <span className="sr-only"> · {countryName(p.primaryNationalityCode)}</span>
            </h2>
            <p className="text-xs text-pitch-muted">
              {career.club.name} ({career.club.league}) · Temporada {career.year} · Jornada{' '}
              {Math.min(career.jornada, career.totalJornadas)}/{career.totalJornadas} · {career.leaguePos}º en liga
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-full bg-pitch-accent/15 px-3 py-1 font-medium text-pitch-accent">Media {overall(p)}</span>
            <span className="text-pitch-muted">Valor {p.valueM.toFixed(1)} M€</span>
          </div>
        </section>

        {screen.type === 'jornada' && <JornadaView career={career} apply={apply} />}
        {screen.type === 'momento' && (
          <section className={`${card} space-y-3`} aria-live="polite">
            <h3 className="text-base font-bold">Momento decisivo</h3>
            <p className="text-sm">{screen.moment.text}</p>
            <div className="grid gap-2">
              {screen.moment.options.map((o) => (
                <button key={o.id} type="button" onClick={() => apply(resolveMoment(career, o.id))} className={`${btnSecondary} flex items-center justify-between text-left`}>
                  <span>{o.label}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      o.risk === 'muyProbable'
                        ? 'bg-pitch-accent/15 text-pitch-accent'
                        : o.risk === 'probable'
                          ? 'bg-sky-500/15 text-sky-300'
                          : o.risk === 'arriesgado'
                            ? 'bg-yellow-500/15 text-yellow-300'
                            : 'bg-pitch-danger/15 text-pitch-danger'
                    }`}
                  >
                    {RISK_LABELS[o.risk]}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        {screen.type === 'resultado' && (
          <section className={`${card} space-y-3`} aria-live="polite">
            <h3 className="text-base font-bold">
              Jornada {screen.result.jornada}: {screen.result.golesFavor}-{screen.result.golesContra}
              {screen.result.rival !== '' ? ` vs ${screen.result.rival}` : ''}
            </h3>
            <p className="text-sm">{screen.result.headline}</p>
            {screen.result.minutos > 0 && (
              <dl className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
                <ResultStat label="Nota" value={screen.result.rating.toFixed(1)} highlight />
                <ResultStat label="Minutos" value={`${screen.result.minutos}'`} />
                {p.position === 'POR' ? (
                  <ResultStat label="Paradas" value={String(screen.result.paradas)} />
                ) : (
                  <ResultStat label="Goles" value={String(screen.result.goles)} />
                )}
                {p.position === 'POR' ? (
                  <ResultStat label="Portería a 0" value={screen.result.porteriaCero ? 'Sí' : 'No'} />
                ) : (
                  <ResultStat label="Asistencias" value={String(screen.result.asistencias)} />
                )}
                <ResultStat label="Pases" value={String(screen.result.pases)} />
                <ResultStat label="Recup." value={String(screen.result.recuperaciones)} />
              </dl>
            )}
            {screen.notes.length > 0 && (
              <ul className="space-y-1 text-xs text-pitch-muted">
                {screen.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => apply(continueFromResult(career))} className={btnPrimary}>
              Continuar
            </button>
          </section>
        )}
        {screen.type === 'evento' && (
          <section className={`${card} space-y-3`} aria-live="polite">
            <h3 className="text-base font-bold">{screen.event.title}</h3>
            <p className="text-sm">{screen.event.text}</p>
            <div className="grid gap-2">
              {screen.event.options.map((o) => (
                <button key={o.id} type="button" onClick={() => apply(resolveEvent(career, o.id))} className={`${btnSecondary} flex items-center justify-between text-left`}>
                  <span>{o.label}</span>
                  <span className="shrink-0 text-xs text-pitch-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {screen.type === 'ofertas' && (
          <section className={`${card} space-y-3`}>
            <h3 className="text-base font-bold">Ofertas sobre la mesa</h3>
            <p className="text-sm text-pitch-muted">{screen.reason}</p>
            <div className="grid gap-3">
              {screen.offers.map((o) => (
                <div key={o.id} className="rounded-lg border border-pitch-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {o.club.name} <span className="text-xs text-pitch-muted">({o.club.league})</span>
                    </p>
                    <p className="text-xs text-pitch-muted">
                      Prestigio {'★'.repeat(o.club.tier)}
                      {o.european ? ' · Competición europea' : ''}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-pitch-muted">
                    {o.years} años · {o.salaryK} mil €/semana · {o.pitch}
                  </p>
                  <button type="button" onClick={() => apply(resolveOffer(career, o.id))} className={`${btnPrimary} mt-2 px-3 py-2 text-sm`}>
                    Aceptar oferta
                  </button>
                </div>
              ))}
            </div>
            {screen.canStay && (
              <button type="button" onClick={() => apply(resolveOffer(career, 'quedarse'))} className={btnSecondary}>
                Quedarme en el {career.club.name}
              </button>
            )}
          </section>
        )}
        {screen.type === 'finTemporada' && (
          <section className={`${card} space-y-3`} aria-live="polite">
            <h3 className="text-base font-bold">Fin de temporada {screen.summary.year}</h3>
            <p className="text-sm">
              {screen.summary.clubName} · {screen.summary.leaguePosition}º en {screen.summary.league} · Objetivos:{' '}
              {screen.summary.objectivesMet}/{screen.summary.objectivesTotal}
            </p>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
              <ResultStat label="PJ" value={String(screen.summary.stats.pj)} />
              <ResultStat label="Goles" value={String(screen.summary.stats.goles)} />
              <ResultStat label="Asist." value={String(screen.summary.stats.asistencias)} />
              <ResultStat label="Nota media" value={screen.summary.avgRating > 0 ? screen.summary.avgRating.toFixed(2) : '—'} highlight />
              <ResultStat label="Porterías a 0" value={String(screen.summary.stats.porteriasCero)} />
              <ResultStat label="Minutos" value={String(screen.summary.stats.minutos)} />
            </dl>
            {(() => {
              const line = percentileLine(career);
              return line != null ? <p className="text-xs text-pitch-muted">{line}</p> : null;
            })()}
            {screen.notes.length > 0 && (
              <ul className="space-y-1 text-sm">
                {screen.notes.map((n, i) => (
                  <li key={i}>· {n}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  track('fin_temporada', { temporada: screen.summary.year });
                  apply(startNextSeason(career, false));
                }}
                className={btnPrimary}
              >
                Siguiente temporada
              </button>
              {p.age >= 32 && (
                <button type="button" onClick={() => apply(startNextSeason(career, true))} className={btnSecondary}>
                  Retirarme aquí
                </button>
              )}
            </div>
          </section>
        )}
        {screen.type === 'finCarrera' && <FinalView career={career} onShare={onShare} copied={copied} onExit={onExit} onDelete={onDelete} />}
      </div>

      {/* Panel lateral: estado, objetivos e historial */}
      <aside className="space-y-4">
        <section className={`${card} space-y-3`} aria-label="Estado del jugador">
          <h3 className="text-sm font-bold">Estado</h3>
          <StatBar label="Forma" value={p.forma} />
          <StatBar label="Moral" value={p.moral} />
          <StatBar label="Condición física" value={p.fitness} />
          <StatBar label="Reputación" value={p.reputacion} />
          <StatBar label="Confianza del entrenador" value={p.coachTrust} />
          {career.injury != null && career.injury.weeksOut > 0 && (
            <p className="rounded-lg bg-pitch-danger/10 p-2 text-xs text-pitch-danger">
              Lesión: {career.injury.name} · {career.injury.weeksOut} {career.injury.weeksOut === 1 ? 'jornada' : 'jornadas'} de baja
            </p>
          )}
        </section>

        <details className={card} open>
          <summary className="cursor-pointer text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent">
            Objetivos de temporada
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {career.objectives.map((o, i) => (
              <li key={i} className={o.done ? 'text-pitch-accent' : 'text-pitch-muted'}>
                {o.done ? '✓' : '○'} {o.label}{' '}
                <span className="opacity-70">({o.level === 'minimo' ? 'mínimo' : o.level === 'principal' ? 'principal' : 'extraordinario'})</span>
              </li>
            ))}
          </ul>
        </details>

        <details className={card}>
          <summary className="cursor-pointer text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent">
            Atributos
          </summary>
          <div className="mt-2 space-y-2">
            {p.position === 'POR'
              ? (Object.keys(GK_ATTR_LABELS) as GkAttr[]).map((k) => <StatBar key={k} label={GK_ATTR_LABELS[k]} value={p.attributes[k]} />)
              : (Object.keys(FIELD_ATTR_LABELS) as FieldAttr[]).map((k) => (
                  <StatBar key={k} label={FIELD_ATTR_LABELS[k]} value={p.attributes[k]} />
                ))}
          </div>
        </details>

        <details className={card}>
          <summary className="cursor-pointer text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent">
            Historial reciente
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-pitch-muted">
            {career.log.slice(0, 12).map((l, i) => (
              <li key={i}>
                <span className="text-pitch-muted/70">{l.year}</span> {l.text}
              </li>
            ))}
          </ul>
        </details>

        <div className={`${card} space-y-2 text-xs text-pitch-muted`}>
          <p>
            Temporada media: {avg > 0 ? avg.toFixed(2) : '—'} · Contrato: {career.contract.yearsLeft}{' '}
            {career.contract.yearsLeft === 1 ? 'año' : 'años'} · {career.contract.salaryK} mil €/semana
          </p>
          <button type="button" onClick={onExit} className={`${btnSecondary} w-full px-3 py-2`}>
            Guardar y salir
          </button>
        </div>
      </aside>
    </div>
  );
}

function ResultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-pitch-border p-2">
      <dt className="text-[10px] uppercase tracking-wide text-pitch-muted">{label}</dt>
      <dd className={`text-sm font-bold ${highlight === true ? 'text-pitch-accent' : ''}`}>{value}</dd>
    </div>
  );
}

function JornadaView({ career, apply }: { career: CareerState; apply: (c: CareerState) => void }) {
  const [approach, setApproach] = useState<MatchApproach>('seguro');
  const injured = career.injury != null && career.injury.weeksOut > 0;

  return (
    <section className={`${card} space-y-4`}>
      <h3 className="text-base font-bold">Próxima jornada</h3>
      {injured ? (
        <p className="text-sm text-pitch-muted">
          Estás lesionado ({career.injury?.name}). La jornada pasará mientras te recuperas.
        </p>
      ) : (
        <>
          <fieldset className="space-y-2">
            <legend className="text-xs text-pitch-muted">Planteamiento del partido</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ['seguro', 'Jugar seguro', 'Menos errores, menos brillo'],
                  ['riesgo', 'Asumir riesgos', 'Más ocasiones… y más fallos'],
                  ['energia', 'Conservar energía', 'Rinde algo menos, fatiga menos'],
                ] as Array<[MatchApproach, string, string]>
              ).map(([id, label, hint]) => (
                <label
                  key={id}
                  className={`cursor-pointer rounded-lg border p-3 text-sm ${
                    approach === id ? 'border-pitch-accent bg-pitch-accent/10' : 'border-pitch-border'
                  }`}
                >
                  <input type="radio" name="planteamiento" value={id} checked={approach === id} onChange={() => setApproach(id)} className="mr-2" />
                  <span className="font-medium">{label}</span>
                  <span className="block text-xs text-pitch-muted">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1 text-sm sm:max-w-xs">
            <span className="text-xs text-pitch-muted">Foco de entrenamiento semanal</span>
            <select
              value={career.training}
              onChange={(e) => apply(setTraining(career, e.target.value as TrainingFocus))}
              className="rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent"
            >
              {TRAININGS.map((t) => (
                <option key={t} value={t}>
                  {TRAINING_LABELS[t].label} · {TRAINING_LABELS[t].cost}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => apply(playJornada(career, approach, true))} className={btnPrimary}>
          {injured ? 'Pasar la jornada' : 'Jugar la jornada'}
        </button>
        <button type="button" onClick={() => apply(simulateBlock(career, 5))} className={btnSecondary}>
          Simular 5 jornadas
        </button>
        {career.player.age >= 33 && (
          <button type="button" onClick={() => apply(retireNow(career))} className={`${btnSecondary} hover:border-pitch-danger hover:text-pitch-danger`}>
            Retirarme ya
          </button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Final de carrera
// ---------------------------------------------------------------------------

function FinalView({
  career,
  onShare,
  copied,
  onExit,
  onDelete,
}: {
  career: CareerState;
  onShare: (card: CareerCard) => void;
  copied: boolean;
  onExit: () => void;
  onDelete: (id: string) => void;
}) {
  const cardData = useMemo(() => buildCareerCard(career), [career]);
  return (
    <section className={`${card} space-y-4`} aria-live="polite">
      <div>
        <h3 className="text-xl font-bold">
          {cardData.name} · <span className="text-pitch-accent">{cardData.legendLevel}</span>
        </h3>
        <p className="text-sm">
          <span aria-hidden="true">{countryFlag(cardData.countryCode)}</span> {cardData.countryName}
          {cardData.nationalTeamCode != null && cardData.nationalTeamCode !== cardData.countryCode
            ? ` · Internacional con ${countryName(cardData.nationalTeamCode)}`
            : ''}
        </p>
        <p className="text-sm text-pitch-muted">{cardData.retirementReason}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
        <ResultStat label="Temporadas" value={String(cardData.seasons)} />
        <ResultStat label="Partidos" value={String(cardData.pj)} />
        <ResultStat label="Goles" value={String(cardData.goles)} />
        <ResultStat label="Asistencias" value={String(cardData.asistencias)} />
        <ResultStat label="Selección" value={`${cardData.caps} caps`} />
        <ResultStat label="Puntuación" value={String(cardData.score)} highlight />
      </dl>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-pitch-muted">Clubes</h4>
          <p className="mt-1">{cardData.clubs.length > 0 ? cardData.clubs.join(' → ') : career.club.name}</p>
          <h4 className="mt-3 text-xs font-bold uppercase tracking-wide text-pitch-muted">Títulos ({cardData.titles.length})</h4>
          <p className="mt-1">{cardData.titles.length > 0 ? cardData.titles.join(', ') : 'Sin títulos'}</p>
          <p className="mt-3 text-xs text-pitch-muted">Valor máximo alcanzado: {cardData.maxValueM.toFixed(1)} M€</p>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-pitch-muted">Logros</h4>
          <ul className="mt-1 space-y-0.5">
            {cardData.achievements.length > 0 ? cardData.achievements.map((a) => <li key={a}>🏅 {a}</li>) : <li>Sin logros destacados</li>}
          </ul>
          {cardData.records.length > 0 && (
            <>
              <h4 className="mt-3 text-xs font-bold uppercase tracking-wide text-pitch-muted">Récords</h4>
              <ul className="mt-1 space-y-0.5">
                {cardData.records.map((r) => (
                  <li key={r}>📜 {r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onShare(cardData)} className={btnPrimary}>
          {copied ? 'Resumen copiado ✓' : 'Copiar resumen para compartir'}
        </button>
        <button type="button" onClick={onExit} className={btnSecondary}>
          Volver al inicio
        </button>
        <button
          type="button"
          onClick={() => onDelete(career.id)}
          className={`${btnSecondary} hover:border-pitch-danger hover:text-pitch-danger`}
        >
          Eliminar carrera
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ranking local
// ---------------------------------------------------------------------------

function RankingView({ ranking, onBack }: { ranking: CareerCard[]; onBack: () => void }) {
  const [countryFilter, setCountryFilter] = useState('');
  const countries = useMemo(() => {
    const codes = Array.from(new Set(ranking.map((c) => c.countryCode)));
    return codes
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ranking]);
  const visible = countryFilter === '' ? ranking : ranking.filter((c) => c.countryCode === countryFilter);

  return (
    <div className="space-y-4">
      <section className={`${card} space-y-3`}>
        <h2 className="text-lg font-bold">Ranking local de carreras</h2>
        <p className="text-xs text-pitch-muted">
          Clasificación de tus carreras terminadas en este dispositivo. La arquitectura está preparada para conectar un ranking
          global cuando exista autenticación.
        </p>
        {countries.length > 1 && (
          <label className="flex max-w-xs flex-col gap-1 text-sm">
            <span className="text-xs text-pitch-muted">Filtrar por país</span>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-lg border border-pitch-border bg-pitch-bg px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-pitch-accent"
            >
              <option value="">Todos los países</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {visible.length === 0 ? (
          <p className="text-sm text-pitch-muted">
            {ranking.length === 0
              ? 'Aún no hay carreras terminadas. ¡Completa tu primera carrera para aparecer aquí!'
              : 'No hay carreras terminadas de ese país.'}
          </p>
        ) : (
          <ol className="space-y-2">
            {visible.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-pitch-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {i + 1}. <span aria-hidden="true">{countryFlag(c.countryCode)}</span> {c.name}{' '}
                    <span className="text-xs text-pitch-muted">
                      ({POSITION_LABELS[c.position]} · {c.countryName})
                    </span>
                  </p>
                  <p className="text-xs text-pitch-muted">
                    {c.seasons} temporadas · {c.goles} goles · {c.titles.length} títulos · Dificultad {DIFFICULTY_LABELS[c.difficulty].label}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-pitch-accent">{c.score}</p>
                  <p className="text-xs text-pitch-muted">{c.legendLevel}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={onBack} className={btnSecondary}>
          Volver
        </button>
      </section>
    </div>
  );
}
