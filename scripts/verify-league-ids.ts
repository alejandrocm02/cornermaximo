/**
 * Verifica los ids de API-Football de las competiciones configuradas.
 *
 * Revisa TRACKED_COMPETITIONS (las que ya se sincronizan) y EXPANSION_CANDIDATES
 * (las preparadas pero inactivas). Un id equivocado no falla en tiempo de
 * ejecución: sincroniza otra competición entera y mete miles de filas erróneas.
 *
 * Uso (PowerShell, con la clave en el entorno solo para este comando):
 *   $env:API_FOOTBALL_KEY="tu-clave"; npx tsx scripts/verify-league-ids.ts
 *
 * O crea un .env en la raíz con API_FOOTBALL_KEY=... y ejecuta:
 *   npx tsx scripts/verify-league-ids.ts
 *
 * Consume 1 petición de la cuota diaria (una sola llamada a /leagues).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPANSION_CANDIDATES, TRACKED_COMPETITIONS, type TrackedCompetition } from '../packages/shared/src/index';

interface LeagueEntry {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: Array<{ year: number; current: boolean }>;
}

/** Carga el .env de la raíz si existe. Evita depender de dotenv. */
function loadDotEnv(): void {
  for (const file of ['.env', '.env.local']) {
    let content: string;
    try {
      content = readFileSync(resolve(process.cwd(), file), 'utf8');
    } catch {
      continue;
    }
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (match == null) continue;
      const [, key, rawValue] = match;
      if (key == null || process.env[key] != null) continue;
      process.env[key] = (rawValue ?? '').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';

async function main(): Promise<void> {
  loadDotEnv();

  const apiKey = process.env.API_FOOTBALL_KEY;
  if (apiKey == null || apiKey === '') {
    console.error('\nFalta API_FOOTBALL_KEY.\n');
    console.error('PowerShell:');
    console.error('  $env:API_FOOTBALL_KEY="tu-clave"; npx tsx scripts/verify-league-ids.ts\n');
    console.error('O crea un .env en la raíz del proyecto con:');
    console.error('  API_FOOTBALL_KEY=tu-clave\n');
    console.error('La clave está en tu panel de Vercel (Settings > Environment Variables)');
    console.error('o en los secrets del repositorio de GitHub.\n');
    process.exit(1);
  }

  let res: Response;
  try {
    res = await fetch(new URL('/leagues', BASE_URL), {
      headers: { 'x-apisports-key': apiKey },
    });
  } catch (err) {
    console.error(`\nNo se pudo contactar con ${BASE_URL}: ${err instanceof Error ? err.message : String(err)}`);
    console.error('Revisa tu conexión o el valor de API_FOOTBALL_BASE_URL.\n');
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`API-Football respondió ${res.status}${res.status === 499 ? ' (clave inválida)' : ''}`);
    process.exit(1);
  }

  const body = (await res.json()) as { response?: LeagueEntry[]; errors?: unknown };
  if (body.response == null) {
    console.error('Respuesta inesperada de API-Football:', JSON.stringify(body.errors ?? body));
    process.exit(1);
  }
  const byId = new Map(body.response.map((e) => [e.league.id, e]));

  let problemas = 0;

  function revisar(comps: readonly TrackedCompetition[], titulo: string): void {
    console.log(`\n${titulo}\n${'─'.repeat(100)}`);
    for (const c of comps) {
      const entry = byId.get(c.apiFootballId);
      const esperado = `${c.name} (${c.country})`.padEnd(38);

      if (entry == null) {
        problemas++;
        console.log(`  ✗  ${String(c.apiFootballId).padEnd(5)} ${esperado} id inexistente en tu plan`);
        continue;
      }

      // El proveedor y nosotros no tenemos por qué usar el mismo nombre
      // ("LaLiga Hypermotion" vs "Segunda División"), así que el país es
      // el criterio fiable. Las competiciones internacionales usan "World".
      const paisOk = entry.country.name.toLowerCase() === c.country.toLowerCase() || c.country === 'World';
      if (!paisOk) problemas++;
      console.log(
        `  ${paisOk ? '✓' : '✗'}  ${String(c.apiFootballId).padEnd(5)} ${esperado} ${entry.league.name} (${entry.country.name})`,
      );

      const disponibles = new Set(entry.seasons.map((s) => s.year));
      const faltan = c.seasons.filter((y) => !disponibles.has(y));
      if (faltan.length > 0) {
        problemas++;
        console.log(`         └─ ⚠️  temporadas no disponibles: ${faltan.join(', ')}`);
      }
    }
  }

  revisar(TRACKED_COMPETITIONS, 'ACTIVAS — se sincronizan ya');
  revisar(EXPANSION_CANDIDATES, 'CANDIDATAS — preparadas pero inactivas');

  console.log(`\n${'─'.repeat(100)}`);
  if (problemas === 0) {
    const total = TRACKED_COMPETITIONS.length + EXPANSION_CANDIDATES.length;
    console.log(`\n✅ ${total} competiciones verificadas, todo correcto.\n`);
  } else {
    console.log(`\n⚠️  ${problemas} problema(s). Corrige los ids en packages/shared antes de desplegar.\n`);
    process.exit(1);
  }
}

void main();
