# Auditoría técnica de CornerMaximo — 19 de agosto de 2026

## Alcance y método

Se auditó el monorepo completo, la rama `main` (`545bbfa`), el deployment de
producción correspondiente, GitHub Actions, el proyecto Supabase conectado y la
configuración de Vercel. La revisión incluyó arquitectura, TypeScript, rutas App
Router, APIs, Prisma/Neon, autenticación y RLS de Supabase, Stripe, sincronización,
dependencias, seguridad, pruebas, build, rendimiento, responsive, accesibilidad y
SEO técnico.

La aplicación conserva su arquitectura actual: npm workspaces, Next.js 15 App
Router, React 19, Prisma 5 sobre PostgreSQL/Neon, Supabase Auth y datos personales,
y Stripe para facturación. No se ha reescrito ninguna funcionalidad.

## Resumen ejecutivo

El producto tiene una base técnica sólida: TypeScript estricto, separación de
paquetes, RLS de propietario en las tablas personales, secretos de servidor
separados, cookies administrativas firmadas, validación Zod, cabeceras defensivas,
CodeQL, tests de dominio y un deployment de Vercel estable. El deployment de
producción auditado coincide exactamente con `main` y no registró HTTP 5xx en sus
últimos siete días.

El riesgo operativo principal es la sincronización deportiva: las 20 ejecuciones
horarias más recientes observadas en GitHub Actions fallaban con HTTP 404 porque
`APP_URL` había derivado en un secreto externo. La rama de auditoría corrige la
fuente del dominio canónico. Hasta que esta PR se fusione, producción puede seguir
sirviendo datos que no se refrescan mediante ese workflow.

La auditoría inicial de npm encontró 9 paquetes vulnerables (1 crítico, 5 altos y
3 moderados). Se corrigieron el Vitest crítico, las vulnerabilidades directas de
Next 15 y PostCSS directo. Quedan 3 avisos altos en dependencias internas de Next
15 (`sharp` y la copia de `postcss` fijada por Next); npm solo ofrece resolverlos
mediante el salto mayor a Next 16.3.1, que debe hacerse en una PR de migración
dedicada.

## Hallazgos priorizados

| Prioridad | Severidad | Problema | Ubicación | Impacto | Resolución |
|---|---|---|---|---|---|
| P0 | CRÍTICO | Las sincronizaciones horarias fallan con 404 de forma consecutiva | `.github/workflows/sync.yml` | Datos deportivos obsoletos y cola sin procesar | Corregido en esta rama fijando y validando el dominio canónico público |
| P1 | ALTO | Vitest 2.1.9 estaba afectado por una vulnerabilidad crítica del servidor UI | `package.json`, `package-lock.json` | Lectura/escritura y ejecución si la UI/API vulnerable se expone | Actualizado y validado a 3.2.6 |
| P1 | ALTO | Next 15.5.20 estaba por debajo del parche de seguridad de mantenimiento | `apps/web/package.json`, `package-lock.json` | DoS, SSRF y divulgación según los avisos agregados de npm | Actualizado dentro de la misma línea a 15.5.23 |
| P1 | ALTO | El endpoint de jugador llamaba `season` a agregados históricos completos | `apps/web/src/app/api/players/[slug]/route.ts` | Estadísticas incorrectas y mezcla de temporadas | Corregido: solo partidos finalizados de temporadas vigentes |
| P1 | ALTO | `/api/rankings` anunciaba `scope=season\|last5` pero ignoraba el parámetro y mezclaba históricos/no finalizados | `apps/web/src/app/api/rankings/route.ts` | Contrato API roto y rankings incorrectos | Implementados ambos scopes con orden temporal y filtros de temporada/estado |
| P1 | ALTO | API-Football no tenía timeout ni reintento de errores de red | `packages/providers/src/api-football/client.ts` | Funciones Vercel de 60 s agotadas y jobs congelados | Añadido timeout de 8 s, reintento y contabilidad por intento, con tests |
| P1 | ALTO | La función `push-alerts` desplegada no coincide con el repositorio y conserva cabecera/nombre heredados | Supabase Edge Function `push-alerts` y `supabase/functions/push-alerts/index.ts` | Un redeploy aislado rompería el cron; deriva de producción | Pendiente: migrar cron y función de forma atómica |
| P1 | ALTO | `main` no tiene branch protection | Configuración de GitHub | Se puede omitir CI/revisión y hacer push directo | Pendiente de habilitar checks requeridos y revisión |
| P1 | ALTO | Quedan 3 avisos altos transitivos fijados por Next 15 | `next > postcss`, `next > sharp` | Riesgo de lectura de sourcemaps y procesamiento de imágenes maliciosas | Pendiente de migración controlada a Next 16; no se forzó un major |
| P2 | MEDIO | El proyecto no tenía comando ni configuración de lint | `package.json`, `eslint.config.mjs`, `.github/workflows/ci.yml` | Errores de hooks, imports y navegación llegaban a revisión manual | Corregido con ESLint 9, reglas oficiales Next/TS y ejecución en CI |
| P2 | MEDIO | El CTA azul no alcanzaba contraste AA (4.10:1) | `apps/web/src/app/globals.css` | Axe: 2 nodos serios en portada | Corregido a 5.42:1 en estado normal y 6.29:1 en hover |
| P2 | MEDIO | Protección de contraseñas filtradas desactivada | Supabase Auth advisor | Contraseñas conocidas en brechas pueden aceptarse | Activar Leaked Password Protection en el panel de Supabase |
| P2 | MEDIO | Historial de migraciones Supabase remoto/local divergente | `supabase/migrations/` frente a migraciones remotas | Entornos nuevos no son reproducibles con certeza | Reconciliar timestamps y añadir las migraciones remotas de cron/deny sin tocar datos |
| P2 | MEDIO | Panel administrativo público sin rate limiting propio | `apps/web/src/app/admin/sincronizacion/actions.ts` | Intentos ilimitados contra un secreto de alta entropía | Añadir limitación por IP/origen en Vercel Firewall o almacenamiento duradero |
| P2 | MEDIO | Webhooks Stripe no registran `event.id`/orden temporal y el cliente REST carece de timeout/idempotency key | `apps/web/src/app/api/billing/webhook/route.ts`, `apps/web/src/lib/stripe-rest.ts` | Eventos fuera de orden o doble clic pueden dejar estado obsoleto/duplicar sesiones | Añadir ledger idempotente y timeout; coordinar con la PR de Stripe abierta |
| P2 | MEDIO | CSP permite `unsafe-inline` en scripts y estilos | `apps/web/next.config.mjs` | Reduce la defensa en profundidad frente a XSS | Migrar a nonce/hash en una tarea específica |
| P2 | MEDIO | Vercel usa Node 24.x mientras CI valida Node 22 | Configuración Vercel y `.github/workflows/ci.yml` | Diferencias de runtime y reproducibilidad | Alinear ambos entornos en una única versión soportada |
| P2 | MEDIO | Cuatro páginas usan `<img>` en vez de `next/image` | jugador, directorio, Mi Corner y scouting | Avisos de lint, optimización/LCP y ancho de banda | Migración pendiente sin reformatear los componentes monolíticos |
| P2 | MEDIO | No hay pruebas web/E2E para Auth, APIs, RLS, Stripe ni rutas críticas | `apps/web` | Regresiones de integración no cubiertas por los 94 tests de dominio | Añadir Playwright y tests de route handlers con DB efímera |
| P3 | BAJO | Componentes heredados de apuestas ya no son alcanzables (las rutas redirigen a Analizador) | `apps/web/src/components/apuestas/` | Código muerto y coste de mantenimiento | Eliminar en una PR separada tras confirmar que no volverán a activarse |
| P3 | BAJO | Componentes y motores muy grandes y compactados en una sola línea | `CareerClient.tsx`, `career/engine.ts`, `AnalizadorClient.tsx` y varias páginas | Revisiones difíciles y mayor riesgo de conflictos | Dividir progresivamente por dominio, sin reescritura |

## Seguridad

- No se encontraron claves privadas, tokens de Stripe/Supabase ni contraseñas de
  producción versionadas en el árbol actual. El escaneo de patrones en el historial
  solo localizó las credenciales efímeras `postgres:postgres` del servicio CI.
- Los endpoints privados de Supabase verifican usuario en servidor y las tablas
  personales auditadas tienen RLS habilitado con políticas por `auth.uid()`.
- El webhook Stripe verifica HMAC con tolerancia temporal y comparación constante.
- El endpoint de sincronización exige Bearer secret y el panel usa cookie HttpOnly,
  Secure en producción, SameSite Strict, firma HMAC y expiración máxima de 4 h.
- Las rutas de cuenta anónimas no incluyen datos privados y emiten la redirección de
  Next a login; sus respuestas llevan `private, no-store`.
- Producción entrega CSP, HSTS, `nosniff`, `DENY`, COOP, Referrer-Policy y
  Permissions-Policy. La CSP todavía debe eliminar `unsafe-inline`.

## Rendimiento, responsive y UX

- Build de producción actual: 102 kB de JavaScript compartido; la ruta más pesada
  es Modo Carrera (31.2 kB propios), sin un bundle global anómalo.
- Medición sintética cálida de portada: TTFB 21.7 ms, FCP 284 ms, LCP 600 ms y CLS 0.
  INP no se calificó porque no hubo una interacción representativa.
- Se verificaron 320×700, 390×844, 768×1024, 1366×768 y 1920×1080. No hubo
  overflow horizontal ni solapamientos. El aviso de cookies ocupa bastante espacio
  útil en móvil, aunque todos sus controles permanecen accesibles.
- Existen estados de carga/error/vacío, focus visible, skip link, objetivos táctiles
  razonables y soporte `prefers-reduced-motion`.

## Accesibilidad WCAG 2.2 AA

La portada de producción tenía una infracción Axe seria de contraste en dos CTA
blancos sobre azul (4.10:1). La rama eleva el contraste por encima de 4.5:1. La
estructura de headings, regiones, enlaces, labels y navegación por teclado revisada
es coherente. Queda pendiente ampliar la automatización Axe a todas las rutas y a
flujos autenticados; los contrastes sobre gradientes marcados por Axe como
“incompletos” requieren revisión visual, no se contabilizaron como fallos confirmados.

## SEO técnico

Se comprobaron title templates, descriptions, canonical, Open Graph/Twitter,
robots, sitemap, manifest, 404 real, metadatos dinámicos y `robots: noindex` en
rutas privadas. `robots.txt` y `sitemap.xml` responden 200; una ruta inexistente
responde 404. El sitemap pesa aproximadamente 2 MB, por debajo del límite del
protocolo, pero conviene monitorizar su crecimiento y dividirlo antes de 50.000 URL.

## Base de datos y datos

- El schema Prisma es válido, usa claves únicas, relaciones y los índices principales
  para partidos, temporadas, clasificaciones, jugadores y cola de sincronización.
- No se aplicaron cambios destructivos ni se escribieron datos de producción.
- La comprobación remota de Supabase confirma RLS en las tablas públicas auditadas.
- Los índices “unused” señalados por Supabase pertenecen a tablas con muy pocas filas;
  no deben eliminarse basándose en esa muestra.
- `PrismaBudgetGuard.canSpend()` y `record()` siguen siendo dos operaciones separadas;
  la concurrencia del workflow reduce el riesgo, pero una reserva atómica sería una
  mejora futura si aparecen invocaciones paralelas externas.

## Validaciones ejecutadas en la rama

| Control | Resultado |
|---|---|
| ESLint | Pasa con 0 errores y 4 avisos de `<img>` conocidos |
| TypeScript | Pasa en todos los workspaces |
| Tests | 94/94 pasan con Vitest 3.2.6 |
| Prisma schema | Válido |
| Build local | Compila y valida tipos; el prerender de `/equipos` no puede completar sin PostgreSQL local |
| Build Vercel de la rama | Correcto, 38/38 páginas estáticas y deployment preview READY |
| npm audit inicial | 9 vulnerabilidades: 1 crítica, 5 altas, 3 moderadas |
| npm audit tras cambios | 3 altas transitivas de Next 15; 0 críticas |
| CodeQL de la PR | Correcto |
| CI de la PR | Correcto: lint, Prisma, tipos, 94 tests, build y audit crítico |
| Workflow `sync` de `main` | Error: 20 fallos consecutivos observados por HTTP 404 |

El build local completo requiere la base efímera que el workflow CI provisiona.
La preview de Vercel y todos los checks de la Pull Request terminaron correctamente;
la fusión queda deliberadamente pendiente de revisión humana.
