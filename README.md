# FutStats

Base de datos y analisis de futbolistas de las 5 grandes ligas europeas, con historico 2025/26, temporada 2026/27 preparada y seccion dedicada al Mundial 2026.

## Coste operativo

| Pieza | Servicio |
|---|---|
| Datos | API-Football, plan pago (7500 req/dia) |
| Web | Vercel Hobby |
| PostgreSQL | Neon |
| Cache | Upstash Redis (opcional) |
| Sincronizacion | GitHub Actions (cron 4 veces al dia) |

## Datos cubiertos

- 5 grandes ligas: LaLiga, Premier League, Serie A, Bundesliga y Ligue 1.
- Temporada historica `2025` = 2025/26.
- Temporada actual `2026` = 2026/27.
- Mundial 2026: API-Football usa `league=1` y `season=2026`.
- Presupuesto configurado: `API_FOOTBALL_DAILY_LIMIT=7500`.
- Ritmo configurable: `API_FOOTBALL_MIN_INTERVAL_MS`.

## Estructura

```text
packages/
  shared/      enums, constantes, competiciones y temporadas soportadas
  db/          schema Prisma + cliente singleton
  providers/   interfaz FootballDataProvider + adaptador API-Football
  stats/       formulas centralizadas y tests
  sync/        orquestador de sincronizacion, presupuesto y jobs
apps/
  web/         Next.js: paginas, API interna, rankings, ligas y Mundial 2026
```

## Cuentas necesarias

1. **API-Football**: https://dashboard.api-football.com/register
   Usa el endpoint directo `https://v3.football.api-sports.io`, no RapidAPI.
2. **GitHub**: https://github.com/signup
   En el repo, anade `SYNC_SECRET` y `APP_URL` en Settings -> Secrets and variables -> Actions.
3. **Neon**: https://neon.tech
   Copia la connection string a `DATABASE_URL`.
4. **Vercel**: https://vercel.com/signup
   Root Directory: `apps/web`.

Variables de entorno en Vercel:

```text
DATABASE_URL
API_FOOTBALL_KEY
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io
API_FOOTBALL_DAILY_LIMIT=7500
API_FOOTBALL_MIN_INTERVAL_MS=1000
SYNC_SECRET
CURRENT_SEASON=2026
NEXT_PUBLIC_APP_URL
```

## Desarrollo local

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm test
npm run dev -w web
```

Primera carga de datos:

```bash
curl -X POST -H "Authorization: Bearer TU_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/admin/sync/run -d '{"season":2025,"maxRequests":100}'

curl -X POST -H "Authorization: Bearer TU_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/admin/sync/run -d '{"season":2026,"maxRequests":100}'
```

## Produccion

1. Despliega en Vercel.
2. Ejecuta migraciones contra Neon: `DATABASE_URL="postgres://..." npm run db:migrate`.
3. Lanza la primera sincronizacion o espera al cron de GitHub Actions.
4. El workflow sincroniza primero 2025 y despues 2026 para mantener historico, nueva temporada y Mundial 2026.

## Reglas de datos

- `null` = no disponible en el proveedor. Nunca se interpreta como 0.
- Division por cero => `null`, nunca `Infinity`.
- Convocado sin minutos (`BENCH_UNUSED`) no cuenta como uno de los ultimos 5 jugados.
- Tendencias solo con al menos 180 minutos por ventana.
- Cada partido tiene una segunda pasada de verificacion 24 h despues.
- Las claves de API viven solo en servidor, nunca en frontend.
