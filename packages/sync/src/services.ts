/**
 * Servicios de sincronización: proveedor -> base de datos.
 * Todos los upserts usan (providerId, externalId) para evitar duplicados.
 */
import type { PrismaClient, Prisma } from '@futstats/db';
import type { FootballDataProvider, ProviderPlayerMatchStats } from '@futstats/providers';
import { TRACKED_COMPETITIONS, toSlug, type PositionGroup } from '@futstats/shared';

// ---------- helpers ----------

async function ensureCountry(db: PrismaClient, name: string): Promise<number> {
  const c = await db.country.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  return c.id;
}

/** slug único: si el base está ocupado por OTRA entidad, se sufija con el externalId. */
async function uniquePlayerSlug(db: PrismaClient, name: string, externalId: string): Promise<string> {
  const base = toSlug(name) || `jugador-${externalId}`;
  const clash = await db.player.findUnique({ where: { slug: base } });
  return clash != null && clash.externalId !== externalId ? `${base}-${externalId}` : base;
}

async function uniqueTeamSlug(db: PrismaClient, name: string, externalId: string): Promise<string> {
  const base = toSlug(name) || `equipo-${externalId}`;
  const clash = await db.team.findUnique({ where: { slug: base } });
  return clash != null && clash.externalId !== externalId ? `${base}-${externalId}` : base;
}

// ---------- competiciones ----------

/**
 * Crea/actualiza cada competición rastreada (5 ligas + Mundial 2026) y TODAS sus
 * temporadas (`TrackedCompetition.seasons`), marcando `isCurrent` solo en la más
 * reciente de cada una. 0 requests: los ids y temporadas son constantes conocidas.
 */
export async function syncCompetitions(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
): Promise<void> {
  const comps = await provider.getCompetitions();
  for (const c of comps) {
    const tracked = TRACKED_COMPETITIONS.find((t) => String(t.apiFootballId) === c.externalId);
    const countryId = await ensureCountry(db, c.country);
    const comp = await db.competition.upsert({
      where: { providerId_externalId: { providerId: providerDbId, externalId: c.externalId } },
      update: { name: c.name, logoUrl: c.logoUrl, type: c.type },
      create: {
        providerId: providerDbId,
        externalId: c.externalId,
        name: c.name,
        slug: tracked?.slug ?? toSlug(c.name),
        type: c.type,
        logoUrl: c.logoUrl,
        countryId,
      },
    });

    const seasons = tracked?.seasons ?? [];
    const latestYear = seasons[seasons.length - 1];
    for (const year of seasons) {
      await db.season.upsert({
        where: { competitionId_year: { competitionId: comp.id, year } },
        update: { isCurrent: year === latestYear },
        create: { competitionId: comp.id, year, isCurrent: year === latestYear },
      });
    }
    // Temporadas históricas (p.ej. 2024-25) fuera de la lista rastreada:
    // se conservan como archivo pero nunca deben quedar marcadas como actuales.
    await db.season.updateMany({
      where: { competitionId: comp.id, year: { notIn: [...seasons] }, isCurrent: true },
      data: { isCurrent: false },
    });
  }
}

// ---------- equipos ----------

export async function syncTeams(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  competitionExternalId: string,
  season: number,
): Promise<number> {
  const comp = await db.competition.findUniqueOrThrow({
    where: { providerId_externalId: { providerId: providerDbId, externalId: competitionExternalId } },
    include: { seasons: { where: { year: season } } },
  });
  const seasonRow = comp.seasons[0];
  if (seasonRow == null) throw new Error(`Season ${season} no existe para ${comp.name}`);

  const teams = await provider.getTeamsByCompetition(competitionExternalId, season);
  for (const t of teams) {
    const countryId = await ensureCountry(db, t.country);

    let stadiumId: number | null = null;
    if (t.stadiumName != null) {
      const existing = await db.stadium.findFirst({
        where: { name: t.stadiumName, city: t.stadiumCity },
      });
      const stadium =
        existing ??
        (await db.stadium.create({
          data: { name: t.stadiumName, city: t.stadiumCity, capacity: t.stadiumCapacity },
        }));
      stadiumId = stadium.id;
    }

    const team = await db.team.upsert({
      where: { providerId_externalId: { providerId: providerDbId, externalId: t.externalId } },
      update: { name: t.name, shortName: t.shortName, crestUrl: t.crestUrl, stadiumId, isNational: t.isNational },
      create: {
        providerId: providerDbId,
        externalId: t.externalId,
        name: t.name,
        shortName: t.shortName,
        slug: await uniqueTeamSlug(db, t.name, t.externalId),
        crestUrl: t.crestUrl,
        founded: t.founded,
        isNational: t.isNational,
        countryId,
        stadiumId,
      },
    });
    await db.seasonTeam.upsert({
      where: { seasonId_teamId: { seasonId: seasonRow.id, teamId: team.id } },
      update: {},
      create: { seasonId: seasonRow.id, teamId: team.id },
    });
  }
  return teams.length;
}

// ---------- plantillas ----------

export async function syncSquad(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  teamDbId: number,
  teamExternalId: string,
): Promise<number> {
  const team = await db.team.findUniqueOrThrow({ where: { id: teamDbId } });
  const players = await provider.getPlayersByTeam(teamExternalId);
  for (const p of players) {
    // Un jugador puede aparecer en dos plantillas: su club y su selección nacional
    // (mismo externalId en API-Football). `currentTeamId` representa el CLUB actual,
    // así que la convocatoria de una selección nunca debe pisarlo; solo lo rellena
    // si el jugador todavía no tiene club conocido en nuestra base de datos.
    const existing = await db.player.findUnique({
      where: { providerId_externalId: { providerId: providerDbId, externalId: p.externalId } },
      select: { currentTeamId: true },
    });
    const setCurrentTeam = !team.isNational || existing?.currentTeamId == null;

    const player = await db.player.upsert({
      where: { providerId_externalId: { providerId: providerDbId, externalId: p.externalId } },
      update: {
        fullName: p.fullName,
        photoUrl: p.photoUrl,
        shirtNumber: p.shirtNumber,
        lastSyncedAt: new Date(),
        ...(setCurrentTeam ? { currentTeamId: teamDbId } : {}),
      },
      create: {
        providerId: providerDbId,
        externalId: p.externalId,
        fullName: p.fullName,
        knownAs: p.knownAs,
        slug: await uniquePlayerSlug(db, p.fullName, p.externalId),
        photoUrl: p.photoUrl,
        shirtNumber: p.shirtNumber,
        currentTeamId: setCurrentTeam ? teamDbId : null,
        lastSyncedAt: new Date(),
      },
    });
    if (p.positionGroup != null) {
      await db.playerPosition.upsert({
        where: {
          playerId_group_specificPosition: {
            playerId: player.id,
            group: p.positionGroup,
            specificPosition: '',
          },
        },
        update: { isPrimary: true },
        create: {
          playerId: player.id,
          group: p.positionGroup,
          specificPosition: '',
          isPrimary: true,
        },
      });
    }
  }
  return players.length;
}

// ---------- calendario y resultados ----------

export async function syncFixtures(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  competitionExternalId: string,
  season: number,
): Promise<number> {
  const comp = await db.competition.findUniqueOrThrow({
    where: { providerId_externalId: { providerId: providerDbId, externalId: competitionExternalId } },
    include: { seasons: { where: { year: season } } },
  });
  const seasonRow = comp.seasons[0];
  if (seasonRow == null) throw new Error(`Season ${season} no existe para ${comp.name}`);

  const fixtures = await provider.getFixtures(competitionExternalId, season);

  // Mapa externalId de equipo -> id interno (una sola consulta)
  const teams = await db.team.findMany({
    where: {
      providerId: providerDbId,
      externalId: { in: fixtures.flatMap((f) => [f.homeTeamExternalId, f.awayTeamExternalId]) },
    },
    select: { id: true, externalId: true },
  });
  const teamId = new Map(teams.map((t) => [t.externalId, t.id]));

  let count = 0;
  for (const f of fixtures) {
    const homeId = teamId.get(f.homeTeamExternalId);
    const awayId = teamId.get(f.awayTeamExternalId);
    if (homeId == null || awayId == null) continue; // equipo aún no sincronizado

    const match = await db.match.upsert({
      where: { providerId_externalId: { providerId: providerDbId, externalId: f.externalId } },
      update: {
        status: f.status,
        kickoffAt: new Date(f.kickoffAt),
        round: f.round,
        hasExtraTime: f.hasExtraTime,
        hasPenalties: f.hasPenalties,
      },
      create: {
        providerId: providerDbId,
        externalId: f.externalId,
        seasonId: seasonRow.id,
        round: f.round,
        kickoffAt: new Date(f.kickoffAt),
        status: f.status,
        hasExtraTime: f.hasExtraTime,
        hasPenalties: f.hasPenalties,
      },
    });

    await db.matchTeam.upsert({
      where: { matchId_isHome: { matchId: match.id, isHome: true } },
      update: { goals: f.homeGoals, penaltyGoals: f.homePenaltyGoals, teamId: homeId },
      create: { matchId: match.id, teamId: homeId, isHome: true, goals: f.homeGoals, penaltyGoals: f.homePenaltyGoals },
    });
    await db.matchTeam.upsert({
      where: { matchId_isHome: { matchId: match.id, isHome: false } },
      update: { goals: f.awayGoals, penaltyGoals: f.awayPenaltyGoals, teamId: awayId },
      create: { matchId: match.id, teamId: awayId, isHome: false, goals: f.awayGoals, penaltyGoals: f.awayPenaltyGoals },
    });
    count++;
  }
  return count;
}

// ---------- estadísticas post-partido (2 requests: alineaciones + stats) ----------

function fieldStatsData(
  s: ProviderPlayerMatchStats,
): Omit<Prisma.PlayerMatchStatisticsUncheckedCreateInput, 'matchPlayerId'> {
  return {
    goals: s.goals,
    assists: s.assists,
    shotsTotal: s.shotsTotal,
    shotsOnTarget: s.shotsOnTarget,
    passesAttempted: s.passesAttempted,
    passesCompleted: s.passesCompleted,
    keyPasses: s.keyPasses,
    dribblesAttempted: s.dribblesAttempted,
    dribblesCompleted: s.dribblesCompleted,
    dribbledPast: s.dribbledPast,
    tacklesAttempted: s.tacklesAttempted,
    blocks: s.blocks,
    interceptions: s.interceptions,
    duelsTotal: s.duelsTotal,
    duelsWon: s.duelsWon,
    foulsCommitted: s.foulsCommitted,
    foulsDrawn: s.foulsDrawn,
    yellowCards: s.yellowCards,
    redCards: s.redCards,
    offsides: s.offsides,
    penaltiesScored: s.penaltiesScored,
    penaltiesMissed: s.penaltiesMissed,
    penaltiesWon: s.penaltiesWon,
    penaltiesCommitted: s.penaltiesCommitted,
    rawProviderData: s.raw as Prisma.InputJsonValue,
    syncedAt: new Date(),
  };
}

export async function syncMatchStats(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  matchDbId: number,
  matchExternalId: string,
): Promise<number> {
  const lineups = await provider.getLineups(matchExternalId); // 1 req
  const stats = await provider.getPlayerMatchStatistics(matchExternalId); // 1 req
  const statsByPlayer = new Map(stats.map((s) => [s.playerExternalId, s]));

  const externalIds = [...new Set([...lineups.map((l) => l.playerExternalId), ...stats.map((s) => s.playerExternalId)])];
  const players = await db.player.findMany({
    where: { providerId: providerDbId, externalId: { in: externalIds } },
    select: { id: true, externalId: true },
  });
  const playerId = new Map(players.map((p) => [p.externalId, p.id]));

  const teamExternalIds = [...new Set(lineups.map((l) => l.teamExternalId))];
  const teams = await db.team.findMany({
    where: { providerId: providerDbId, externalId: { in: teamExternalIds } },
    select: { id: true, externalId: true },
  });
  const teamId = new Map(teams.map((t) => [t.externalId, t.id]));

  let processed = 0;
  for (const entry of lineups) {
    const pid = playerId.get(entry.playerExternalId);
    const tid = teamId.get(entry.teamExternalId);
    if (pid == null || tid == null) continue; // jugador/equipo desconocido: se registra en el log del runner

    const s = statsByPlayer.get(entry.playerExternalId);
    const minutes = s?.minutes ?? 0;
    // Suplente que no entró => BENCH_UNUSED (no cuenta en "últimos 5 jugados")
    const role = entry.role === 'SUBSTITUTE' && minutes === 0 ? 'BENCH_UNUSED' : entry.role;

    const mp = await db.matchPlayer.upsert({
      where: { matchId_playerId: { matchId: matchDbId, playerId: pid } },
      update: {
        role,
        minutesPlayed: minutes,
        rating: s?.rating ?? null,
        positionPlayed: s?.positionPlayed ?? entry.positionPlayed,
        isCaptain: s?.isCaptain ?? false,
        teamId: tid,
      },
      create: {
        matchId: matchDbId,
        playerId: pid,
        teamId: tid,
        role,
        positionPlayed: s?.positionPlayed ?? entry.positionPlayed,
        shirtNumber: entry.shirtNumber,
        minutesPlayed: minutes,
        rating: s?.rating ?? null,
        isCaptain: s?.isCaptain ?? false,
      },
    });

    if (s != null && minutes > 0) {
      if (s.isGoalkeeper) {
        const gkData = {
          goalsConceded: s.goalsConceded,
          cleanSheet: s.goalsConceded != null ? s.goalsConceded === 0 : null,
          saves: s.saves,
          penaltiesSaved: s.penaltiesSaved,
          passesAttempted: s.passesAttempted,
          passesCompleted: s.passesCompleted,
          rawProviderData: s.raw as Prisma.InputJsonValue,
          syncedAt: new Date(),
        };
        await db.goalkeeperMatchStatistics.upsert({
          where: { matchPlayerId: mp.id },
          update: gkData,
          create: { matchPlayerId: mp.id, ...gkData },
        });
      } else {
        const data = fieldStatsData(s);
        await db.playerMatchStatistics.upsert({
          where: { matchPlayerId: mp.id },
          update: data,
          create: { matchPlayerId: mp.id, ...data },
        });
      }
      processed++;
    }
  }
  return processed;
}

// ---------- clasificación ----------

export async function syncStandings(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  competitionExternalId: string,
  season: number,
): Promise<number> {
  const comp = await db.competition.findUniqueOrThrow({
    where: { providerId_externalId: { providerId: providerDbId, externalId: competitionExternalId } },
    include: { seasons: { where: { year: season } } },
  });
  const seasonRow = comp.seasons[0];
  if (seasonRow == null) return 0;

  const rows = await provider.getStandings(competitionExternalId, season);
  for (const r of rows) {
    const team = await db.team.findUnique({
      where: { providerId_externalId: { providerId: providerDbId, externalId: r.teamExternalId } },
    });
    if (team == null) continue;
    await db.standing.upsert({
      where: { seasonId_teamId: { seasonId: seasonRow.id, teamId: team.id } },
      update: {
        group: r.group,
        position: r.position, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points, form: r.form,
      },
      create: {
        seasonId: seasonRow.id, teamId: team.id, group: r.group,
        position: r.position, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
        goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points, form: r.form,
      },
    });
  }
  return rows.length;
}

// ---------- lesiones ----------

export async function syncInjuries(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  competitionExternalId: string,
  season: number,
): Promise<number> {
  const injuries = await provider.getInjuries(competitionExternalId, season);
  let count = 0;
  for (const inj of injuries) {
    const player = await db.player.findUnique({
      where: { providerId_externalId: { providerId: providerDbId, externalId: inj.playerExternalId } },
    });
    if (player == null) continue;

    const startDate = inj.date != null ? new Date(inj.date) : new Date();
    const existing = await db.injury.findFirst({
      where: { playerId: player.id, startDate, type: inj.type },
    });
    if (existing == null) {
      await db.injury.create({
        data: { playerId: player.id, type: inj.type, reason: inj.reason, startDate },
      });
    }
    // Estado del jugador: "Duda" si el proveedor lo marca como cuestionable, si no lesionado.
    const status = inj.type?.toLowerCase().includes('question') ? 'DOUBT' : 'INJURED';
    if (!player.manuallyEdited) {
      await db.player.update({ where: { id: player.id }, data: { status } });
    }
    count++;
  }
  return count;
}

// ---------- traspasos (mercado) ----------

/**
 * El proveedor a veces registra la misma operación (mismo jugador y mismos clubes)
 * con dos fechas próximas. Conservamos la más reciente y borramos el resto.
 */
export async function cleanupTransferDuplicates(db: PrismaClient): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "Transfer" a
    USING "Transfer" b
    WHERE a."playerExternalId" = b."playerExternalId"
      AND a."externalKey" <> b."externalKey"
      AND COALESCE(a."fromName", '') = COALESCE(b."fromName", '')
      AND COALESCE(a."toName", '') = COALESCE(b."toName", '')
      AND (a."date" < b."date" OR (a."date" = b."date" AND a."externalKey" < b."externalKey"))
      AND b."date" - a."date" <= INTERVAL '45 days'`;
}

/** Fecha desde la que interesan los movimientos (mercado 2025 en adelante). */
const TRANSFERS_SINCE = new Date('2025-06-01');

function transferType(typeRaw: string | null): { type: string; fee: string | null } {
  if (typeRaw == null || typeRaw === 'N/A') return { type: 'DESCONOCIDO', fee: null };
  const t = typeRaw.trim();
  if (/^loan$/i.test(t)) return { type: 'CESION', fee: null };
  if (/loan/i.test(t)) return { type: 'REGRESO_CESION', fee: null };
  if (/^free/i.test(t)) return { type: 'AGENTE_LIBRE', fee: null }; // "Free", "Free agent", "Free transfer"
  if (/^(transfer|permanent|swap)$/i.test(t)) return { type: 'TRASPASO', fee: null }; // sin cifra revelada
  // Un importe real ("€ 40M", "$ 12M"...) es un traspaso con cifra reportada por el proveedor
  if (/[€$£]|\d/.test(t)) return { type: 'TRASPASO', fee: t };
  return { type: 'DESCONOCIDO', fee: null }; // texto no monetario: nunca mostrarlo como cuota
}

export async function syncTransfers(
  db: PrismaClient,
  provider: FootballDataProvider,
  providerDbId: number,
  teamDbId: number,
  teamExternalId: string,
): Promise<number> {
  const transfers = await provider.getTransfers(teamExternalId);
  const recent = transfers.filter((t) => new Date(t.date) >= TRANSFERS_SINCE);
  if (recent.length === 0) return 0;

  const externalIds = [
    ...new Set(
      recent
        .flatMap((t) => [t.teamInExternalId, t.teamOutExternalId, t.playerExternalId])
        .filter((x): x is string => x != null),
    ),
  ];
  const [teams, players] = await Promise.all([
    db.team.findMany({ where: { providerId: providerDbId, externalId: { in: externalIds } }, select: { id: true, externalId: true } }),
    db.player.findMany({ where: { providerId: providerDbId, externalId: { in: externalIds } }, select: { id: true, externalId: true } }),
  ]);
  const teamId = new Map(teams.map((t) => [t.externalId, t.id]));
  const playerId = new Map(players.map((p) => [p.externalId, p.id]));

  // El proveedor repite a veces la misma operación con fechas cercanas: nos quedamos con la más reciente
  const byMove = new Map<string, (typeof recent)[number]>();
  for (const t of recent) {
    const key = `${t.playerExternalId}|${t.teamOutExternalId ?? t.teamOutName ?? '-'}|${t.teamInExternalId ?? t.teamInName ?? '-'}`;
    const prev = byMove.get(key);
    if (prev == null || new Date(t.date) > new Date(prev.date)) byMove.set(key, t);
  }

  let count = 0;
  for (const t of byMove.values()) {
    const { type, fee } = transferType(t.typeRaw);
    const externalKey = `api-football|${t.playerExternalId}|${t.date}|${t.teamOutExternalId ?? '-'}|${t.teamInExternalId ?? '-'}`;
    await db.transfer.upsert({
      where: { externalKey },
      update: { type, fee, playerName: t.playerName },
      create: {
        externalKey,
        playerExternalId: t.playerExternalId,
        playerId: playerId.get(t.playerExternalId) ?? null,
        playerName: t.playerName,
        fromTeamId: t.teamOutExternalId != null ? (teamId.get(t.teamOutExternalId) ?? null) : null,
        toTeamId: t.teamInExternalId != null ? (teamId.get(t.teamInExternalId) ?? null) : null,
        fromName: t.teamOutName,
        toName: t.teamInName,
        type,
        fee,
        date: new Date(t.date),
      },
    });
    count++;
  }
  return count;
}
