# Auditoría técnica completa de CornerMaximo — 19 de agosto de 2026

## Alcance y método

Se revisó el monorepo completo sobre `main` (`178272a`), su deployment de
producción, las rutas y APIs de Next.js, Prisma/Neon, Supabase Auth y RLS,
funciones Edge, Stripe, GitHub Actions, dependencias, seguridad, rendimiento,
responsive, accesibilidad y SEO. También se reprodujeron y clasificaron las 11
PR abiertas al comenzar el trabajo y el issue #31.

La arquitectura se conserva: npm workspaces, Next.js App Router, React, Prisma
sobre PostgreSQL/Neon, Supabase para Auth y datos personales, Stripe para
facturación y Vercel para ejecución. No se ha reescrito la aplicación.

## Resumen ejecutivo

El proyecto queda en una base moderna y verificable: Next.js 16.3.1, React
19.2.8, Node 24, Prisma 7.9.1 con adaptador PostgreSQL, Supabase JS 2.112.3 y
Zod 4.4.3. Lint, TypeScript, 105 tests unitarios, 12 E2E, build de producción y
`npm audit` pasan. La suite E2E cubre WCAG automatizada, 320/768/1440 px,
autorización de rutas/APIs y flujos de registro, login y recuperación.

Se corrigieron los riesgos altos confirmados: vulnerabilidades npm, migración
Prisma incompleta, CSP de scripts, webhooks Stripe no idempotentes, peticiones
Stripe sin timeout, rate limiting administrativo volátil, deriva de migraciones
Supabase, cron push heredado, imágenes no optimizadas, falta de pruebas web y
la ausencia de sincronización del Analizador/CM Compare exigida por el issue #31.

No queda ningún P0 conocido. El principal control pendiente es activar en el
panel de Supabase Auth la protección contra contraseñas filtradas. El otro
riesgo operativo importante es crear y ensayar una migración baseline de Prisma
para la base deportiva histórica antes de automatizar `prisma migrate deploy`.

## Arquitectura actual

- `apps/web`: Next.js 16 App Router. Server Components por defecto, Client
  Components solo para interacción, Route Handlers para APIs y `proxy.ts` para
  sesión/CSP.
- `packages/db`: Prisma 7, `@prisma/adapter-pg` y cliente generado fuera de
  `node_modules`.
- `packages/providers`, `stats`, `sync`, `shared`: proveedor API-Football,
  fórmulas, orquestación de sincronización y contratos compartidos.
- `supabase/migrations`: datos personales con RLS, billing, push, rate limiting
  y estados de aplicación.
- `supabase/functions`: borrado de cuenta y entrega de push.
- GitHub Actions: CI con PostgreSQL efímero, CodeQL y sincronización horaria.

## Hallazgos priorizados

| Prioridad | Severidad | Problema | Archivo/servicio | Impacto | Solución/estado |
|---|---|---|---|---|---|
| P0 | CRÍTICO | No quedan hallazgos P0 confirmados | — | — | Corregidos o descartados con evidencia |
| P1 | ALTO | Protección contra contraseñas filtradas desactivada | Supabase Auth | Permite elegir contraseñas conocidas en brechas | Pendiente: habilitar en Auth → Password Security |
| P1 | ALTO | No existe baseline versionada para el schema deportivo de Prisma | `packages/db/prisma/` | `migrate deploy` no puede reproducir de cero con seguridad la base histórica | Crear baseline, marcarla aplicada en Neon y ensayar restore/deploy |
| P2 | MEDIO | CSP conserva `unsafe-inline` solo en estilos | `apps/web/src/lib/security/csp.ts` | Reduce la defensa de CSS frente a inyección; scripts sí usan nonce estricto | Migrar estilos inline dinámicos progresivamente |
| P2 | MEDIO | Los E2E de Auth usan respuestas simuladas y límites reales de autorización; no crean una cuenta real | `e2e/web-quality.spec.ts` | No prueba el proveedor de correo ni una eliminación exitosa real | Añadir entorno Supabase efímero para el ciclo destructivo completo |
| P2 | MEDIO | Identidad legal, contacto, bases/plazos definitivos pendientes | `privacidad`, `aviso-legal`, `sobre` | Cumplimiento incompleto antes de explotación comercial | Debe aportar los datos reales el titular; no se inventaron |
| P3 | BAJO | Componentes/motores grandes y varias páginas compactadas | `CareerClient.tsx`, `career/engine.ts`, `AnalizadorClient.tsx` | Revisiones y cambios más costosos | Dividir por dominio de forma incremental |
| P3 | BAJO | Supabase informa seis índices todavía no usados | tablas personales/billing | Coste de escritura potencial, hoy mínimo | Mantener y reevaluar con tráfico; no borrar por una muestra pequeña |

## Correcciones implementadas

### Plataforma, tipos y dependencias

- Migración controlada a Next.js 16.3.1 y React 19.2.8; `middleware.ts` pasa a
  `proxy.ts` según la convención actual.
- Node/CI/Vercel alineados en Node 24 mediante `.nvmrc`, `engines`,
  `setup-node@v7` y `checkout@v7`; CodeQL usa v4.
- Prisma 7 completado con `prisma.config.ts`, output explícito, adaptador `pg` y
  URLs runtime/direct separadas.
- ESLint 9 convertido a flat config nativo; lint de Next/TypeScript ejecutado en
  CI sin ignorados masivos.
- Vulnerabilidad transitiva de `deepmerge-ts` resuelta mediante override 8.0.1,
  validado con Prisma y build. `npm audit --omit=dev --audit-level=high`: 0.
- Tipografías Inter/Space Grotesk autoalojadas; el build ya no depende de Google.

### Seguridad

- CSP por petición con nonce, `strict-dynamic`, `object-src 'none'`,
  `frame-ancestors 'none'` y sin `unsafe-inline` en scripts. JSON-LD y Turnstile
  reciben el nonce.
- URLs remotas de `next/image` restringidas a hosts y `/football/**`.
- Login del panel de sincronización limitado de forma duradera por clave HMAC de
  IP, ventana de 15 minutos, lock transaccional y fallo cerrado.
- Cookies Supabase con refresh token revocado se eliminan sin silenciar otros
  errores.
- Cierre de sesión global explícito; cachés personales se borran al salir.
- No se encontraron secretos con forma de Stripe, Supabase service role o claves
  privadas en los archivos versionados. `.env.example` distingue claves públicas
  y de servidor.

### Supabase, cuentas e issue #31

- Historial local reconciliado con las versiones remotas; cron push renombrado y
  función desplegada con la cabecera actual.
- `delete-account` desplegada con JWT obligatorio y Supabase JS actualizado.
- Tabla `user_app_state` para `analyzer` y `comparisons`: dos filas máximas por
  usuario, JSONB <= 1 MiB, RLS, anónimo sin privilegios, timestamps/revisiones
  impuestos por trigger y RPC `SECURITY INVOKER`.
- El Analizador mantiene copia local, importa el estado local al vincular la
  primera cuenta, sincroniza con debounce y usa última escritura recibida.
- CM Compare permite guardar/eliminar hasta 20 comparaciones y sincronizarlas.
- Exportación de cuenta incluye ambos estados; el borrado Auth los elimina por
  cascada y limpia la copia local.
- Alertas leídas/preferencias, favoritos y watchlists ya estaban sincronizados y
  se conservaron.
- Política de privacidad, cookies y copy de Auth actualizados para explicar los
  datos y la resolución de conflictos.

### Stripe

- API estable fijada, timeout de 10 s y claves de idempotencia en Checkout/Portal.
- Managed Payments activado en Checkout.
- Webhook con validación de estructura, firma HMAC probada, ledger por `event.id`
  y rechazo transaccional de eventos duplicados o antiguos.
- Tablas de ledger con RLS y denegación explícita al cliente.

### Rendimiento, responsive, accesibilidad y SEO

- `<img>` de jugadores, Mi Corner y scouting convertido a `next/image` donde los
  dominios son controlables; prioridad conservada en el LCP del perfil.
- Fuentes locales y carga `swap`; rutas pesadas siguen aisladas por App Router.
- Playwright comprueba ausencia de overflow a 320, 768 y 1440 px.
- Axe no detectó violaciones WCAG 2.2 AA en portada, login y Pro. Se mantienen
  skip link, foco visible, reduced motion, labels, headings y regiones.
- Titles, descriptions, canonical, Open Graph/Twitter, JSON-LD, robots, sitemap,
  manifest, 404 y `noindex` privado están presentes y responden correctamente.
- La suite ejecutada contra producción pasó 8/8; los cuatro tests de Auth con
  mocks quedan reservados al build efímero para no crear usuarios reales.

## Base de datos

- Prisma schema válido con relaciones, claves e índices principales.
- Supabase: RLS comprobado en `user_app_state`; anónimo sin acceso; usuario
  autenticado solo a través de políticas de propietario; no puede borrar el
  snapshot ni falsificar revisión/timestamp.
- Stripe y rate limiting usan funciones transaccionales/advisory lock.
- No se realizaron cambios destructivos sobre datos existentes.
- `private.push_runtime_config` permanece sin RLS por decisión explícita: está
  fuera del esquema público, sin privilegios de cliente y solo accesible desde
  funciones controladas. No se modificó automáticamente.

## Validaciones locales antes de publicar

| Control | Resultado real |
|---|---|
| Lint | ✅ 0 errores, 0 warnings |
| Typecheck | ✅ todos los workspaces |
| Tests unitarios | ✅ 105/105 |
| E2E local | ✅ 12/12 (PostgreSQL se provisiona en CI) |
| E2E producción actual | ✅ 8/8 |
| Prisma generate/validate | ✅ |
| Build producción | ✅ Next 16.3.1 + Webpack, 37/37 páginas |
| npm audit producción | ✅ 0 vulnerabilidades |
| Supabase security advisor | ⚠️ solo protección de contraseñas filtradas desactivada |
| Responsive automatizado | ✅ 320/768/1440 px sin overflow |
| Accesibilidad automatizada | ✅ Axe WCAG 2.2 AA en 3 rutas; revisión manual amplia sigue recomendada |
| SEO técnico | ✅ controles esenciales comprobados |
| CI de la rama | ⏳ se completa tras publicar la PR |
| Deployment actualizado | ⏳ se completa tras fusionar la PR |

## Inventario de cambios

Los cambios se separan en commits de plataforma, seguridad/datos, cuentas/tests y
documentación. El detalle exacto por archivo queda en la pestaña **Files changed**
de la PR consolidada; no se incluyen archivos generados (`.next`, reportes de
Playwright ni cliente Prisma).

Archivos eliminados deliberadamente:

- `apps/web/src/middleware.ts`: sustituido por `apps/web/src/proxy.ts` en Next 16.
- Los cinco archivos de `apps/web/src/components/apuestas/`: código muerto desde
  que ambas rutas redirigen a `/analizador`.
- Cinco migraciones Supabase con timestamps locales incorrectos: sustituidas por
  el mismo SQL con las versiones remotas exactas, sin eliminar tablas ni datos.

## Trabajo pendiente

1. Activar Leaked Password Protection en Supabase Auth.
2. Crear/ensayar la baseline de Prisma contra una copia de Neon antes de tocar
   producción.
3. Completar identidad legal/contacto/plazos reales.
4. Añadir un Supabase efímero en CI para probar registro confirmado, sesión real
   y borrado exitoso de extremo a extremo.
5. Monitorizar los índices “unused” con tráfico suficiente antes de decidir.
