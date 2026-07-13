# FutStats

Base de datos y análisis de futbolistas de las 5 grandes ligas europeas.
Foco del producto: **rendimiento en los últimos 5 partidos** (totales, medias por partido y por 90', tendencias objetivas).

## Coste operativo: 0 €/mes

| Pieza | Servicio (free tier) |
|---|---|
| Datos | API-Football, plan gratuito (100 req/día) |
| Web | Vercel Hobby |
| PostgreSQL | Neon |
| Caché | Upstash Redis (opcional) |
| Sincronización | GitHub Actions (cron 4×/día) |

Implicación del plan gratuito: las estadísticas detalladas de una jornada completa
quedan sincronizadas en ≤ 72 h (resultados y alineaciones, el mismo día).
Si se pasa a un plan de pago, solo cambia la frecuencia: cero cambios de código.

## Estructura

```
packages/
├─ shared/      # enums, constantes (las 5 ligas + ids API-Football), utilidades
├─ db/          # schema Prisma (PostgreSQL) + cliente singleton
├─ providers/   # FootballDataProvider (interfaz) + adaptador API-Football
│               # con control de presupuesto de requests y reintentos
├─ stats/       # fórmulas centralizadas: per90, porcentajes, agregados
│               # de últimos 5, tendencias — con tests
└─ sync/        # orquestador: presupuesto en BD, prioridades, upserts,
                # primera pasada post-partido + verificación a las 24h
apps/
└─ web/         # Next.js 15: API interna + páginas (inicio, jugadores,
                # perfil con últimos 5, equipos, ligas, rankings, comparador)
```

## Cuentas necesarias (todas gratuitas)

1. **API-Football** — https://dashboard.api-football.com/register
   Plan "Free" (100 req/día). Copia tu API key → variable `API_FOOTBALL_KEY`.
   Regístrate en el dashboard de api-football.com directamente, NO vía RapidAPI.
2. **GitHub** — https://github.com/signup
   Sube este proyecto a un repositorio; GitHub Actions ejecutará la sincronización 4 veces al día.
   En el repo: Settings → Secrets and variables → Actions → añade `SYNC_SECRET` y `APP_URL`.
3. **Neon** (PostgreSQL) — https://neon.tech
   Crea un proyecto → copia la "Connection string" → variable `DATABASE_URL`.
4. **Vercel** (hosting) — https://vercel.com/signup (entra con tu cuenta de GitHub)
   Importa el repositorio. Configuración del proyecto:
   - Root Directory: `apps/web`
   - Variables de entorno: `DATABASE_URL`, `API_FOOTBALL_KEY`, `SYNC_SECRET`, `CURRENT_SEASON`, `NEXT_PUBLIC_APP_URL`
5. **Upstash** (Redis, opcional) — https://upstash.com — solo cuando quieras activar la caché.

## Puesta en marcha (desarrollo local)

```bash
npm install
cp .env.example .env          # añade tu API_FOOTBALL_KEY
docker compose up -d          # Postgres + Redis locales
npm run db:generate
npm run db:migrate            # crea las tablas
npm test                      # 36 tests
npm run dev -w web            # http://localhost:3000
```

Primera carga de datos (con el servidor en marcha):

```bash
curl -X POST -H "Authorization: Bearer TU_SYNC_SECRET" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/admin/sync/run -d '{"maxRequests":25}'
```

## Puesta en marcha (producción)

1. Crea las cuentas de arriba y despliega en Vercel.
2. Ejecuta las migraciones contra Neon: `DATABASE_URL="postgres://..." npm run db:migrate`.
3. Lanza la primera sincronización con el `curl` anterior apuntando a tu dominio de Vercel,
   o espera al cron de GitHub Actions.
4. El bootstrap completo (5 ligas, ~100 equipos, ~2.500 jugadores) tarda 3-4 días
   por el límite de 100 req/día. Después, el mantenimiento usa ~40-50 req/día.

## Reglas de datos

- `null` = "no disponible en el proveedor". Nunca se interpreta como 0.
- División por cero => `null`, jamás `Infinity`.
- Convocado sin minutos (`BENCH_UNUSED`) no cuenta como uno de los últimos 5 jugados.
- Tendencias solo con ≥ 180 min por ventana (±10% de banda de estabilidad); si no, `INSUFFICIENT_SAMPLE`.
- Cada partido tiene una segunda pasada de verificación 24 h después (correcciones del proveedor).
- Las claves de API viven solo en el servidor (`.env`), nunca en el frontend.
