import { prisma } from '@futstats/db';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { FOOTBALL_DATA_CACHE_TAG, FOOTBALL_DATA_REVALIDATE_SECONDS } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Buscador avanzado de jugadores | FutStats',
  description: 'Filtra futbolistas por edad, posición, liga, minutos y rendimiento por 90 para scouting y comparación.',
  alternates: { canonical: '/scouting' },
};

const POSITIONS = [
  { value: 'GK', label: 'Portero' },
  { value: 'DF', label: 'Defensa' },
  { value: 'MF', label: 'Centrocampista' },
  { value: 'FW', label: 'Delantero' },
] as const;

const SORTS = [
  { value: 'minutos', label: 'Más minutos' },
  { value: 'goles90', label: 'Goles /90' },
  { value: 'asistencias90', label: 'Asistencias /90' },
  { value: 'pasesclave90', label: 'Pases clave /90' },
  { value: 'tiros90', label: 'Tiros a puerta /90' },
  { value: 'edad', label: 'Más jóvenes' },
  { value: 'nombre', label: 'Nombre' },
] as const;

type SortKey = (typeof SORTS)[number]['value'];

type ScoutingRow = {
  id: number;
  slug: string;
  name: string;
  photoUrl: string | null;
  team: string | null;
  position: string | null;
  age: number | null;
  minutes: bigint;
  appearances: bigint;
  goalsPer90: number | null;
  assistsPer90: number | null;
  keyPassesPer90: number | null;
  shotsOnTargetPer90: number | null;
};

const getLeagueOptions = unstable_cache(
  () => prisma.competition.findMany({
    where: { type: 'LEAGUE' },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  }),
  ['scouting-league-options-v1'],
  { revalidate: FOOTBALL_DATA_REVALIDATE_SECONDS, tags: [FOOTBALL_DATA_CACHE_TAG] },
);

function parseInteger(value: string | undefined, min: number, max: number): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function parseDecimal(value: string | undefined, min: number, max: number): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, parsed));
}

function fmt(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

export default async function ScoutingPage({
  searchParams,
}: {
  searchParams: Promise<{
    posicion?: string;
    liga?: string;
    edadMin?: string;
    edadMax?: string;
    minutosMin?: string;
    minutosMax?: string;
    goles90?: string;
    asistencias90?: string;
    pasesClave90?: string;
    tiros90?: string;
    orden?: string;
  }>;
}) {
  const search = await searchParams;
  const posicion = POSITIONS.some((item) => item.value === search.posicion) ? search.posicion! : '';
  const liga = (search.liga ?? '').slice(0, 60).trim();
  const edadMin = parseInteger(search.edadMin, 14, 50);
  const edadMax = parseInteger(search.edadMax, 14, 50);
  const minutosMin = parseInteger(search.minutosMin, 0, 10000);
  const minutosMax = parseInteger(search.minutosMax, 0, 10000);
  const goles90 = parseDecimal(search.goles90, 0, 10);
  const asistencias90 = parseDecimal(search.asistencias90, 0, 10);
  const pasesClave90 = parseDecimal(search.pasesClave90, 0, 30);
  const tiros90 = parseDecimal(search.tiros90, 0, 30);
  const orden: SortKey = SORTS.some((item) => item.value === search.orden)
    ? (search.orden as SortKey)
    : 'minutos';

  const cteConditions: string[] = [`m.status = 'FINISHED'`, `se."isCurrent" = TRUE`];
  const whereConditions: string[] = ['stats.minutes > 0'];
  const params: unknown[] = [];

  if (liga !== '') {
    params.push(liga);
    cteConditions.push(`c.slug = $${params.length}`);
  }
  if (posicion !== '') {
    params.push(posicion);
    whereConditions.push(`EXISTS (
      SELECT 1 FROM "PlayerPosition" pp
      WHERE pp."playerId" = p.id AND pp."isPrimary" AND pp."group" = $${params.length}::"PositionGroup"
    )`);
  }
  if (edadMin != null) {
    params.push(edadMin);
    whereConditions.push(`p."birthDate" IS NOT NULL AND DATE_PART('year', AGE(CURRENT_DATE, p."birthDate")) >= $${params.length}`);
  }
  if (edadMax != null) {
    params.push(edadMax);
    whereConditions.push(`p."birthDate" IS NOT NULL AND DATE_PART('year', AGE(CURRENT_DATE, p."birthDate")) <= $${params.length}`);
  }
  if (minutosMin != null) {
    params.push(minutosMin);
    whereConditions.push(`stats.minutes >= $${params.length}`);
  }
  if (minutosMax != null) {
    params.push(minutosMax);
    whereConditions.push(`stats.minutes <= $${params.length}`);
  }

  const metricFilter = (value: number | null, expression: string) => {
    if (value == null) return;
    params.push(value);
    whereConditions.push(`${expression} IS NOT NULL AND ${expression} >= $${params.length}`);
  };
  metricFilter(goles90, `stats.goals * 90.0 / NULLIF(stats."metricMinutes", 0)`);
  metricFilter(asistencias90, `stats.assists * 90.0 / NULLIF(stats."metricMinutes", 0)`);
  metricFilter(pasesClave90, `stats."keyPasses" * 90.0 / NULLIF(stats."metricMinutes", 0)`);
  metricFilter(tiros90, `stats."shotsOnTarget" * 90.0 / NULLIF(stats."metricMinutes", 0)`);

  const orderSql: Record<SortKey, string> = {
    minutos: 'stats.minutes DESC, name ASC',
    goles90: '"goalsPer90" DESC NULLS LAST, stats.minutes DESC',
    asistencias90: '"assistsPer90" DESC NULLS LAST, stats.minutes DESC',
    pasesclave90: '"keyPassesPer90" DESC NULLS LAST, stats.minutes DESC',
    tiros90: '"shotsOnTargetPer90" DESC NULLS LAST, stats.minutes DESC',
    edad: 'age ASC NULLS LAST, stats.minutes DESC',
    nombre: 'name ASC',
  };

  const rows = await prisma.$queryRawUnsafe<ScoutingRow[]>(
    `WITH stats AS (
      SELECT
        mp."playerId",
        SUM(mp."minutesPlayed")::bigint AS minutes,
        COUNT(*)::bigint AS appearances,
        SUM(pms.goals)::double precision AS goals,
        SUM(pms.assists)::double precision AS assists,
        SUM(pms."keyPasses")::double precision AS "keyPasses",
        SUM(pms."shotsOnTarget")::double precision AS "shotsOnTarget",
        SUM(CASE WHEN pms."matchPlayerId" IS NOT NULL THEN mp."minutesPlayed" ELSE 0 END)::double precision AS "metricMinutes"
      FROM "MatchPlayer" mp
      JOIN "Match" m ON m.id = mp."matchId"
      JOIN "Season" se ON se.id = m."seasonId"
      JOIN "Competition" c ON c.id = se."competitionId"
      LEFT JOIN "PlayerMatchStatistics" pms ON pms."matchPlayerId" = mp.id
      WHERE ${cteConditions.join(' AND ')} AND mp."minutesPlayed" > 0
      GROUP BY mp."playerId"
    )
    SELECT
      p.id,
      p.slug,
      COALESCE(p."knownAs", p."fullName") AS name,
      p."photoUrl" AS "photoUrl",
      team.name AS team,
      (
        SELECT pp."group"::text FROM "PlayerPosition" pp
        WHERE pp."playerId" = p.id AND pp."isPrimary" LIMIT 1
      ) AS position,
      CASE WHEN p."birthDate" IS NULL THEN NULL ELSE DATE_PART('year', AGE(CURRENT_DATE, p."birthDate"))::int END AS age,
      stats.minutes,
      stats.appearances,
      CASE WHEN stats.goals IS NULL OR stats."metricMinutes" = 0 THEN NULL ELSE stats.goals * 90.0 / stats."metricMinutes" END AS "goalsPer90",
      CASE WHEN stats.assists IS NULL OR stats."metricMinutes" = 0 THEN NULL ELSE stats.assists * 90.0 / stats."metricMinutes" END AS "assistsPer90",
      CASE WHEN stats."keyPasses" IS NULL OR stats."metricMinutes" = 0 THEN NULL ELSE stats."keyPasses" * 90.0 / stats."metricMinutes" END AS "keyPassesPer90",
      CASE WHEN stats."shotsOnTarget" IS NULL OR stats."metricMinutes" = 0 THEN NULL ELSE stats."shotsOnTarget" * 90.0 / stats."metricMinutes" END AS "shotsOnTargetPer90"
    FROM stats
    JOIN "Player" p ON p.id = stats."playerId"
    LEFT JOIN "Team" team ON team.id = p."currentTeamId"
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY ${orderSql[orden]}
    LIMIT 60`,
    ...params,
  );

  const leagues = await getLeagueOptions();
  const activeFilters = [posicion, liga, edadMin, edadMax, minutosMin, minutosMax, goles90, asistencias90, pasesClave90, tiros90]
    .filter((value) => value != null && value !== '').length;

  return (
    <div className="space-y-6">
      <header className="fs-panel p-6 sm:p-8">
        <p className="fs-eyebrow">Scouting FutStats</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Buscador avanzado</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-pitch-muted">
          Encuentra perfiles por edad, demarcación, liga, minutos y producción por 90. Las métricas se calculan sobre temporadas actuales y solo con datos disponibles del proveedor.
        </p>
      </header>

      <form method="GET" action="/scouting" className="fs-panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect label="Posición" name="posicion" value={posicion} options={POSITIONS} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Liga</span>
          <select name="liga" defaultValue={liga} className="rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white">
            <option value="">Todas las ligas</option>
            {leagues.map((league) => <option key={league.slug} value={league.slug}>{league.name}</option>)}
          </select>
        </label>
        <RangeInput label="Edad" minName="edadMin" maxName="edadMax" minValue={edadMin} maxValue={edadMax} />
        <RangeInput label="Minutos" minName="minutosMin" maxName="minutosMax" minValue={minutosMin} maxValue={minutosMax} />
        <NumberFilter label="Goles /90 mínimo" name="goles90" value={goles90} step="0.05" />
        <NumberFilter label="Asistencias /90 mínimo" name="asistencias90" value={asistencias90} step="0.05" />
        <NumberFilter label="Pases clave /90 mínimo" name="pasesClave90" value={pasesClave90} step="0.1" />
        <NumberFilter label="Tiros a puerta /90 mínimo" name="tiros90" value={tiros90} step="0.1" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-pitch-muted">Ordenar</span>
          <select name="orden" defaultValue={orden} className="rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white">
            {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
          <button type="submit" className="fs-btn-primary">Buscar perfiles</button>
          {activeFilters > 0 && <Link href="/scouting" className="fs-btn-ghost">Limpiar</Link>}
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="fs-chip" role="status">{rows.length} perfiles mostrados{rows.length === 60 ? ' · refina para reducir la muestra' : ''}</p>
        <Link href="/comparador" className="text-sm text-pitch-accent hover:underline">Abrir comparador →</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((player) => (
          <article key={player.id} className="fs-panel p-4">
            <div className="flex items-center gap-3">
              {player.photoUrl != null ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={player.photoUrl} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full object-cover" />
              ) : <span className="h-[52px] w-[52px] rounded-full bg-pitch-border" />}
              <div className="min-w-0 flex-1">
                <Link href={`/jugadores/${player.slug}`} className="font-semibold hover:text-pitch-accent">{player.name}</Link>
                <p className="truncate text-xs text-pitch-muted">{player.team ?? 'Sin equipo'} · {player.age ?? '—'} años · {player.minutes.toString()} min</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Metric label="G /90" value={fmt(player.goalsPer90)} />
              <Metric label="A /90" value={fmt(player.assistsPer90)} />
              <Metric label="PC /90" value={fmt(player.keyPassesPer90)} />
              <Metric label="TAP /90" value={fmt(player.shotsOnTargetPer90)} />
            </div>
            <div className="mt-4 flex gap-2">
              <Link href={`/jugadores/${player.slug}`} className="fs-btn-ghost inline-flex flex-1 justify-center text-xs">Ver ficha</Link>
              <Link href={`/comparador?p1=${player.slug}`} className="fs-btn-ghost inline-flex flex-1 justify-center text-xs">Comparar</Link>
            </div>
          </article>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="fs-panel p-8 text-center text-sm text-pitch-muted">
          No hay jugadores que cumplan todos esos filtros. Reduce uno o varios mínimos para ampliar la muestra.
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value: string; options: readonly { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-pitch-muted">{label}</span>
      <select name={name} defaultValue={value} className="rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white">
        <option value="">Todas</option>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}

function RangeInput({ label, minName, maxName, minValue, maxValue }: { label: string; minName: string; maxName: string; minValue: number | null; maxValue: number | null }) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="text-xs text-pitch-muted">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" name={minName} defaultValue={minValue ?? ''} placeholder="Mín" min={0} className="min-w-0 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white" />
        <input type="number" name={maxName} defaultValue={maxValue ?? ''} placeholder="Máx" min={0} className="min-w-0 rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white" />
      </div>
    </fieldset>
  );
}

function NumberFilter({ label, name, value, step }: { label: string; name: string; value: number | null; step: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-pitch-muted">{label}</span>
      <input type="number" name={name} defaultValue={value ?? ''} min={0} step={step} className="rounded-lg border border-pitch-border bg-pitch-bg/80 px-3 py-2.5 text-white" />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-pitch-border bg-pitch-bg/40 px-2 py-2">
      <p className="font-semibold">{value}</p>
      <p className="text-[10px] text-pitch-muted">{label}</p>
    </div>
  );
}
