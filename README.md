# CornerMaximo

Base de datos y análisis de futbolistas de las 5 grandes ligas europeas — temporadas
**2025-26** y **2026-27** — más una sección dedicada al **Mundial 2026** (Canadá,
México y EE. UU.), en juego actualmente.
Foco del producto: **rendimiento en los últimos 5 partidos** (totales, medias por
partido y por 90', tendencias objetivas), más clasificaciones y estadísticas
colectivas por competición.

## Coste operativo: 19 $/mes

| Pieza | Servicio |
|---|---|
| Datos | API-Football, plan **Pro** (7 500 req/día, 300 req/min, todas las temporadas y competiciones) |
| Web | Vercel Hobby |
| PostgreSQL | Neon |
| Cuentas y datos personales | Supabase Auth + Postgres con RLS |
| Caché | Upstash Redis (opcional) |
| Sincronización | GitHub Actions (cron cada hora) |

El plan Pro (19 $/mes) da acceso a la temporada en curso y a competiciones
como el Mundial. Competiciones y temporadas rastreadas (fijas en código, en
`packages/shared`: `TRACKED_COMPETITIONS`):

- Las 5 grandes ligas, temporadas **2025** (2025-26, para cerrar/corregir datos
  de la temporada terminada) y **2026** (2026-27, en curso).
- **Mundial 2026** (`league=1`, `season=2026` en API-Football): fase de grupos,
  eliminatorias, clasificación por grupo, goleadores/asistencias y estadísticas
  de cada partido — igual de completo que las ligas de clubes.

Las estadísticas de una jornada completa se sincronizan en pocas horas (antes
podían tardar hasta 72 h con el plan gratuito). Si algún día cambias de plan,
solo hay que tocar `API_FOOTBALL_DAILY_LIMIT` / `API_FOOTBALL_MIN_INTERVAL_MS`.

## Estructura

```
packages/
├─ shared/      # enums, constantes (5 ligas + Mundial 2026 + temporadas rastreadas), utilidades
├─ db/          # schema Prisma (PostgreSQL) + cliente singleton
├─ providers/   # FootballDataProvider (interfaz) + adaptador API-Football
│               # con control de presupuesto de requests y reintentos
├─ stats/       # fórmulas centralizadas: per90, porcentajes, agregados
│               # de últimos 5, tendencias — con tests
└─ sync/        # orquestador: presupuesto en BD, prioridades, upserts,
                # primera pasada post-partido + verificación a las 24h,
                # multi-temporada y multi-competición (ligas + Mundial)
apps/
└─ web/         # Next.js 16 + React 19: API interna + páginas (inicio, jugadores,
                # perfil con últimos 5, equipos, ligas con selector de
                # temporada, Mundial 2026, rankings, comparador)
```

## Cuentas necesarias

1. **API-Football** — https://dashboard.api-football.com/register
   Plan **Pro** (19 $/mes, 7 500 req/día). Copia tu API key → variable `API_FOOTBALL_KEY`.
   Regístrate en el dashboard de api-football.com directamente, NO vía RapidAPI.
2. **GitHub** (gratis) — https://github.com/signup
   Sube este proyecto a un repositorio; GitHub Actions ejecutará la sincronización cada hora.
   En el repo: Settings → Secrets and variables → Actions → añade `SYNC_SECRET` y `APP_URL`.
3. **Neon** (PostgreSQL, gratis) — https://neon.tech
   Crea un proyecto → copia la "Connection string" → variable `DATABASE_URL`.
4. **Supabase** — Auth, favoritos, alertas, watchlists, comparaciones y estado del Analizador con RLS.
5. **Vercel** (hosting, gratis) — https://vercel.com/signup (entra con tu cuenta de GitHub)
   Importa el repositorio. Configuración del proyecto:
   - Root Directory: `apps/web`
   - Variables de entorno: usa `.env.example` como inventario; no expongas claves de servidor con prefijo `NEXT_PUBLIC_`.
6. **Stripe** (opcional) — necesario únicamente para CornerMaximo Pro; configura webhook e identificador de precio según `.env.example`.
7. **Upstash** (Redis, opcional, gratis) — https://upstash.com — solo cuando quieras activar la caché.

## Puesta en marcha (desarrollo local)

```bash
nvm use                         # Node 24, definido en .nvmrc
npm ci
cp .env.example .env          # añade tu API_FOOTBALL_KEY
docker compose up -d          # Postgres + Redis locales
npm run db:generate
npm run db:push               # solo contra la base local/efímera
npm run lint
npm run typecheck
npm test
npm run build
npm run dev -w web            # http://localhost:3000
```

La suite E2E (`npm run test:e2e`) usa Playwright y Axe. Requiere un build previo y,
cuando se ejecuta localmente, una base PostgreSQL preparada. CI provisiona
PostgreSQL 16, ejecuta lint, tipos, tests, build, E2E/WCAG, `npm audit` y CodeQL.

Primera carga de datos (con el servidor en marcha; cada tanda gasta hasta
`maxRequests` peticiones, así que puedes lanzar varias seguidas):

```bash
curl -X POST -H "Authorization: Bearer TU_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/admin/sync/run -d '{"maxRequests":200}'
```

## Puesta en marcha (producción)

1. Crea las cuentas de arriba y despliega en Vercel.
2. Para una base Neon existente, no uses `db:push`: crea/revisa una migración
   Prisma y ensáyala antes de `npm run db:deploy`. El esquema histórico actual
   todavía necesita una migración baseline antes de automatizar ese paso.
   Las migraciones de datos personales se versionan en `supabase/migrations/`.
3. Lanza la primera sincronización con el `curl` anterior apuntando a tu dominio de Vercel,
   o espera al cron de GitHub Actions (cada hora).
4. El bootstrap completo (5 ligas × 2 temporadas + Mundial 2026: ~110 equipos,
   ~3.000 jugadores, ~2.100 partidos de liga + 104 del Mundial) tarda varias
   horas con el plan Pro (7 500 req/día, 300 req/min), no días. El
   mantenimiento diario posterior usa muchas menos peticiones.

## Reglas de datos

- `null` = "no disponible en el proveedor". Nunca se interpreta como 0.
- División por cero => `null`, jamás `Infinity`.
- Convocado sin minutos (`BENCH_UNUSED`) no cuenta como uno de los últimos 5 jugados.
- Tendencias solo con ≥ 180 min por ventana (±10% de banda de estabilidad); si no, `INSUFFICIENT_SAMPLE`.
- Cada partido tiene una segunda pasada de verificación 24 h después (correcciones del proveedor).
- Las claves de API viven solo en el servidor (`.env`), nunca en el frontend.
