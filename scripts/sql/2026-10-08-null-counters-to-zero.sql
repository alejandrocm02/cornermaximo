-- Normaliza a 0 los contadores que API-Football envía como null cuando valen cero.
--
-- Contexto: en producción (8-oct-2026, 130.639 actuaciones con minutos) había
-- 114.370 filas con goals = NULL frente a 4.647 con goals = 0; faltas, tiros,
-- pases clave, entradas, intercepciones y duelos seguían el mismo patrón.
-- El mapper (packages/providers/src/api-football/mappers.ts) ya aplica esta
-- regla a todo lo que se sincroniza a partir de ahora; este script corrige las
-- filas guardadas antes.
--
-- Regla (idéntica a la del mapper):
--   * Solo actuaciones con minutos > 0.
--   * Solo filas con estadísticas reales: al menos un contador no nulo. Una fila
--     completamente vacía sigue siendo "sin datos" y no se le inventan ceros.
--   * No se tocan filas corregidas a mano (correctedAt no nulo).
--   * No se tocan métricas que API-Football no proporciona (recuperaciones,
--     entradas ganadas, xG…): esas siguen en NULL.
--
-- Es idempotente: ejecutarlo dos veces no cambia nada la segunda vez.
-- Uso: Neon → SQL Editor → pegar y ejecutar. Primero el bloque de VISTA PREVIA.

-- ===================== VISTA PREVIA (no modifica nada) =====================
SELECT
  count(*)                                   AS filas_a_normalizar,
  count(*) FILTER (WHERE s.goals IS NULL)    AS goles_null,
  count(*) FILTER (WHERE s."keyPasses" IS NULL) AS pases_clave_null
FROM "PlayerMatchStatistics" s
JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
WHERE mp."minutesPlayed" > 0
  AND s."correctedAt" IS NULL
  AND num_nonnulls(
        s.goals, s.assists, s."shotsTotal", s."shotsOnTarget", s."passesAttempted", s."keyPasses",
        s."tacklesAttempted", s.blocks, s.interceptions, s."duelsTotal", s."duelsWon",
        s."dribblesAttempted", s."dribblesCompleted", s."dribbledPast",
        s."foulsDrawn", s."foulsCommitted", s.offsides
      ) > 0
  AND num_nulls(
        s.goals, s.assists, s."shotsTotal", s."shotsOnTarget", s."passesAttempted", s."passesCompleted",
        s."keyPasses", s."tacklesAttempted", s.blocks, s.interceptions, s."duelsTotal", s."duelsWon",
        s."dribblesAttempted", s."dribblesCompleted", s."dribbledPast", s."foulsDrawn", s."foulsCommitted",
        s."yellowCards", s."redCards", s.offsides, s."penaltiesScored", s."penaltiesMissed",
        s."penaltiesWon", s."penaltiesCommitted"
      ) > 0;

-- ========================= CORRECCIÓN =========================
BEGIN;

UPDATE "PlayerMatchStatistics" s
SET goals                = COALESCE(s.goals, 0),
    assists              = COALESCE(s.assists, 0),
    "shotsTotal"         = COALESCE(s."shotsTotal", 0),
    "shotsOnTarget"      = COALESCE(s."shotsOnTarget", 0),
    "passesAttempted"    = COALESCE(s."passesAttempted", 0),
    "passesCompleted"    = COALESCE(s."passesCompleted", 0),
    "keyPasses"          = COALESCE(s."keyPasses", 0),
    "tacklesAttempted"   = COALESCE(s."tacklesAttempted", 0),
    blocks               = COALESCE(s.blocks, 0),
    interceptions        = COALESCE(s.interceptions, 0),
    "duelsTotal"         = COALESCE(s."duelsTotal", 0),
    "duelsWon"           = COALESCE(s."duelsWon", 0),
    "dribblesAttempted"  = COALESCE(s."dribblesAttempted", 0),
    "dribblesCompleted"  = COALESCE(s."dribblesCompleted", 0),
    "dribbledPast"       = COALESCE(s."dribbledPast", 0),
    "foulsDrawn"         = COALESCE(s."foulsDrawn", 0),
    "foulsCommitted"     = COALESCE(s."foulsCommitted", 0),
    "yellowCards"        = COALESCE(s."yellowCards", 0),
    "redCards"           = COALESCE(s."redCards", 0),
    offsides             = COALESCE(s.offsides, 0),
    "penaltiesScored"    = COALESCE(s."penaltiesScored", 0),
    "penaltiesMissed"    = COALESCE(s."penaltiesMissed", 0),
    "penaltiesWon"       = COALESCE(s."penaltiesWon", 0),
    "penaltiesCommitted" = COALESCE(s."penaltiesCommitted", 0)
FROM "MatchPlayer" mp
WHERE mp.id = s."matchPlayerId"
  AND mp."minutesPlayed" > 0
  AND s."correctedAt" IS NULL
  AND num_nonnulls(
        s.goals, s.assists, s."shotsTotal", s."shotsOnTarget", s."passesAttempted", s."keyPasses",
        s."tacklesAttempted", s.blocks, s.interceptions, s."duelsTotal", s."duelsWon",
        s."dribblesAttempted", s."dribblesCompleted", s."dribbledPast",
        s."foulsDrawn", s."foulsCommitted", s.offsides
      ) > 0
  AND num_nulls(
        s.goals, s.assists, s."shotsTotal", s."shotsOnTarget", s."passesAttempted", s."passesCompleted",
        s."keyPasses", s."tacklesAttempted", s.blocks, s.interceptions, s."duelsTotal", s."duelsWon",
        s."dribblesAttempted", s."dribblesCompleted", s."dribbledPast", s."foulsDrawn", s."foulsCommitted",
        s."yellowCards", s."redCards", s.offsides, s."penaltiesScored", s."penaltiesMissed",
        s."penaltiesWon", s."penaltiesCommitted"
      ) > 0;

-- Porteros: paradas y penaltis parados que llegaron como null en una fila con datos.
UPDATE "GoalkeeperMatchStatistics" g
SET saves            = COALESCE(g.saves, 0),
    "penaltiesSaved" = COALESCE(g."penaltiesSaved", 0)
FROM "MatchPlayer" mp
WHERE mp.id = g."matchPlayerId"
  AND mp."minutesPlayed" > 0
  AND g."correctedAt" IS NULL
  AND (g."goalsConceded" IS NOT NULL OR g."passesAttempted" IS NOT NULL)
  AND (g.saves IS NULL OR g."penaltiesSaved" IS NULL);

COMMIT;

-- ===================== COMPROBACIÓN =====================
-- Tras ejecutarlo, goles_null debería quedar solo en las filas totalmente vacías.
SELECT
  count(*) FILTER (WHERE s.goals IS NULL) AS goles_null,
  count(*) FILTER (WHERE s.goals = 0)     AS goles_cero,
  count(*)                                AS filas
FROM "PlayerMatchStatistics" s
JOIN "MatchPlayer" mp ON mp.id = s."matchPlayerId"
WHERE mp."minutesPlayed" > 0;
