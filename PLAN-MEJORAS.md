# CornerMaximo — Plan de mejoras

Elaborado el 27/07/2026 tras auditar el código local y navegar la web en producción
(`cornermaximo-b87781hgo-corner-maximo.vercel.app`).

> El repositorio local está al día con producción (`main`, commit `fd262c4`). Nota: el modo
> carrera vive en `/modo-carrera`, no en `/mi-carrera`.

---

## Fase 0 — Medir antes de optimizar

| # | Tarea |
|---|---|
| 0.1 | Medir el estado real: Core Web Vitals en Vercel Analytics, tiempo de respuesta de las queries más pesadas, consumo de cómputo de Neon |
| 0.2 | Fijar una línea base antes de optimizar, para poder demostrar la mejora |

Sin el paso 0.1 las optimizaciones de la Fase 1 son a ciegas.

---

## Fase 1 — Arreglos de alto impacto y bajo coste

### 1.1 `/equipos` devuelve 404

Existe `apps/web/src/app/equipos/[slug]/page.tsx` pero no hay `page.tsx` en el índice, ni
enlace en la navegación. Las fichas de equipo son inalcanzables salvo escribiendo la URL.

- Crear `apps/web/src/app/equipos/page.tsx`: grid agrupado por liga, con escudo, buscador
  y filtro por competición y país.
- Añadir "Equipos" al menú de navegación.
- Generar `generateStaticParams` para las fichas de equipo (son ~100, cambian poco).

### 1.2 Falta el club en la cabecera de la ficha de jugador

Verificado en `/jugadores/a-andrade`: muestra `DF · Panama · #16` sin ningún dato de club.
El código local sí contempla `currentTeam`, así que probablemente sea un problema de datos
(jugadores cuyo `currentTeamId` es nulo porque solo tienen partidos de selección).

- Mostrar explícitamente "Sin club registrado" en vez de omitir el campo.
- Añadir escudo del club junto al nombre.
- Si el jugador tiene `PlayerTeamHistory`, mostrar el último club conocido con su fecha.

### 1.3 Descubrimiento de jugadores inutilizable

4.253 jugadores repartidos en **178 páginas** ordenadas alfabéticamente por nombre
abreviado. La primera página son diecinueve jugadores cuyo apellido empieza por "A" y que
nadie está buscando.

- Cambiar el orden por defecto: relevancia (minutos jugados en la temporada) en vez de A-Z.
- Añadir al selector "Ordenar por": Minutos, Goles, Asistencias, Valoración media.
- Filtro "solo jugadores con estadísticas": buena parte de los 4.253 no tiene ni un partido
  registrado y ensucia el listado.
- Sustituir la paginación anterior/siguiente por paginación numerada con salto directo, o
  por scroll infinito.

> **Dependencia técnica:** ordenar 4.253 jugadores por `SUM()` sobre
> `PlayerMatchStatistics` en cada carga no es viable. Requiere la tabla agregada de 2.1.

### 1.4 Caché y coste de base de datos

Todas las páginas llevan `export const dynamic = 'force-dynamic'`, así que cada visita
ejecuta el conjunto completo de queries contra Neon. La portada lanza siete en paralelo.

- Sustituir por `export const revalidate = 3600` con `revalidateTag()` disparado al
  terminar la sincronización. Los datos se actualizan cada hora según indica el footer, no
  hay ninguna razón para no cachearlos.
- `/rankings` hace `fetch()` HTTP contra su propia API usando `VERCEL_URL` desde un Server
  Component. Es un salto de red innecesario: debe llamar directamente a
  `getCompetitionLeaderboard()`. Además su `try/catch` silencioso convierte cualquier fallo
  en una tabla vacía sin explicación.
- Migrar `<img>` a `next/image` en portada, listado y ficha.

---

## Fase 2 — Profundidad analítica

### 2.1 Tabla agregada de estadísticas por jugador y temporada

Es la pieza que desbloquea casi todo lo demás.

Nuevo modelo `PlayerSeasonAggregate`: `playerId`, `seasonId`, `competitionId`, `matches`,
`minutes`, y los totales de las métricas relevantes, más `updatedAt`. Se recalcula al final
de cada ciclo de sincronización, no en tiempo de request.

Permite: ordenar el listado por rendimiento, rankings instantáneos, percentiles por
posición y comparaciones sin recorrer partido a partido.

### 2.2 Gráficos

La web es un producto de estadísticas y ahora mismo todo son tablas y tarjetas numéricas.

- Ficha de jugador: línea de valoración partido a partido, barras de minutos, radar de la
  huella del jugador frente a la media de su posición y liga.
- Ligas: evolución de puntos por jornada.
- Recharts ya está disponible en el stack; es la opción natural con React.

### 2.3 Percentiles por posición

Con 2.1 en marcha: mostrar en la ficha "está en el percentil 87 de centrocampistas de
LaLiga en pases clave por 90'". Es el tipo de dato que diferencia una base de datos de una
herramienta de análisis.

### 2.4 Enriquecer `/ligas`

Hoy son cinco tarjetas con nombre y país sobre una página casi vacía.

- Escudo de la competición y bandera del país.
- Clasificación (el modelo `Standing` ya existe, con campo `form` tipo "WWDLW").
- Máximos goleadores (`getCompetitionLeaderboard()` ya está implementado).
- Últimos resultados y próxima jornada.
- Acceso a los equipos de esa liga.

---

## Fase 3 — Comparador

- Ampliar de 2 a 4 jugadores. `SavedComparison.playerIds` ya es `Int[]`, y el endpoint
  `/api/compare` acepta una lista separada por comas: el límite está en la interfaz.
- Radar comparativo y barras por métrica.
- Alternar entre totales, por partido y por 90 minutos.
- URL compartible (`/comparador?players=a,b,c`) para que la comparación se pueda enlazar.
- Mantener el aviso al comparar portero contra jugador de campo, que ya funciona.

---

## Fase 4 — Persistencia y cuentas de usuario

### 4.1 Autenticación

`User`, `FavoritePlayer`, `FavoriteTeam` y `SavedComparison` llevan tiempo en el schema sin
una sola pantalla que los use. Sin auth no hay favoritos, ni comparaciones guardadas, ni
"Mi Carrera" persistente.

Propuesta: Auth.js (NextAuth v5) con adaptador Prisma sobre Neon, enlace mágico por correo
u OAuth de Google. Evita gestionar contraseñas, lo cual es preferible.

### 4.2 Mi Carrera

Hoy la partida vive solo en `localStorage`: se pierde al cambiar de dispositivo, al limpiar
el navegador o en modo incógnito. Para un modo que se juega "en sesiones cortas" a lo largo
de semanas, eso es una pérdida de progreso garantizada.

- Modelo `CareerSave` con el estado serializado y `userId`.
- Migración transparente: al iniciar sesión, subir la partida local existente.
- Mantener `localStorage` como fallback para quien no quiera cuenta.

### 4.3 Apuestas

El aviso legal está bien planteado y la herramienta no procesa dinero real, lo cual es lo
correcto. Margen de mejora:

- Calcular la probabilidad implícita de cada mercado a partir de vuestros propios datos
  históricos: forma reciente, media de goles, porcentaje de partidos con ambos equipos
  marcando, porcentaje de más de 2,5 goles.
- Contrastarla con la cuota introducida a mano y señalar dónde hay valor. Esto convierte la
  sección en algo que usa la base de datos, en vez de una calculadora genérica.
- Persistir los cupones y liquidarlos automáticamente contra el marcador final.
- Valorar una verificación de edad, dado el contenido.

---

## Transversal

| Tema | Acción |
|---|---|
| Móvil | Diez elementos de navegación sin menú hamburguesa. Verificar y añadir |
| Estados de carga | No hay `loading.tsx` ni `error.tsx`: pantalla en blanco mientras cargan las queries |
| SEO | Faltan `sitemap.ts`, `robots.ts` y OG images dinámicas. Con 4.253 fichas indexables es mucho tráfico orgánico desaprovechado |
| Accesibilidad | Las fotos usan `alt=""`; revisar contraste del texto atenuado sobre fondo oscuro |
| Sincronización | `maxDuration = 60` es el techo de Vercel Hobby. Con colas largas el job se corta a media ejecución |
| Seguridad | `$queryRawUnsafe` con interpolación de nombre de columna. Hoy está acotado por lista blanca, pero conviene blindarlo con un mapa cerrado |
| Panel admin | `SyncJob`, `SyncLog` y `RequestBudget` solo son consultables por SQL. Una pantalla protegida ahorraría mucho tiempo de diagnóstico |
| Tests | Solo hay `packages/stats/test/formulas.test.ts`. Las agregaciones de la Fase 2 necesitan cobertura |

---

## Orden sugerido

1. **Fase 0** — sincronizar y medir
2. **1.1 y 1.2** — arreglos visibles en una tarde
3. **1.4** — caché, reduce coste de Neon de inmediato
4. **2.1** — tabla agregada, desbloquea el resto
5. **1.3** — descubrimiento de jugadores, ya con la tabla lista
6. **2.2 y 2.3** — gráficos y percentiles
7. **Fase 3** — comparador
8. **Fase 4** — auth y persistencia

Las fases 1 y 2 mejoran lo que ya existe. La 4 añade producto nuevo y es la más costosa:
merece la pena solo si hay intención de retener usuarios registrados.
