# Margen de consumo de Vercel Hobby

Objetivo operativo: mantener cada recurso mensual entre el 75% y el 80% de su
cuota como máximo. No es un objetivo de gastar el porcentaje restante.

Hobby no dispone de Spend Management. Estos ajustes reducen carga controlable;
no imponen un tope de cuota ni miden el consumo mensual del equipo. El tráfico,
los despliegues y otros proyectos del equipo también pueden consumir recursos.

## Ajustes aplicados

| Actividad | Antes | Ahora | Efecto con igual tiempo de uso |
| --- | --- | --- | --- |
| Marcadores en directo | 15 s | 20 s | 25% menos sondeos periódicos |
| Marcadores sin directo | 60 s | 80 s | 25% menos sondeos periódicos |
| Eventos de partido | 60 s | 80 s | 25% menos sondeos periódicos |
| Detalle de partido | 180 s | 240 s | 25% menos sondeos periódicos |
| Noticias | 120 s | 160 s | 25% menos sondeos periódicos |
| Tandas de sincronización por hora | Hasta 10 | Hasta 8 | 20% menos invocaciones máximas programadas |

Las cachés públicas de los tres endpoints de directo usan el mismo intervalo
que sus clientes. Se mantienen la pausa del sondeo en pestañas ocultas, la
actualización inicial y la actualización final de los partidos. Las novedades
pueden tardar algo más en aparecer. La sincronización sigue siendo horaria;
si agota las ocho tandas, el trabajo pendiente continúa en futuras ejecuciones.

Las imágenes se sirven desde el proveedor (configuración aplicada anteriormente),
sin nuevas transformaciones en Vercel. Esto no borra consumo ya acumulado.
El presupuesto de API-Football es independiente del de Vercel.

## Umbrales de referencia, no límites configurados

Cuotas publicadas consultadas el 12 de septiembre de 2026:

| Recurso | Cuota Hobby | Aviso operativo 75% | Techo objetivo 80% |
| --- | --- | --- | --- |
| CPU activa | 4 h | 3 h | 3,2 h |
| Memoria provisionada | 360 GB-h | 270 GB-h | 288 GB-h |
| Invocaciones de funciones | 1.000.000 | 750.000 | 800.000 |
| Solicitudes Edge | 1.000.000 | 750.000 | 800.000 |

No se han creado alertas automáticas ni un apagado de la web: la conexión
disponible no proporciona la medición mensual ni la configuración de cuotas.
Revisar Usage del equipo para cada recurso y su periodo. Al alcanzar el 75%,
revisar rutas y funciones que más consumen; antes del 80%, ajustar actividad
no esencial en función de esos datos. Reducir sondeos un 25% no garantiza que
el consumo total quede por debajo del 80% de las cuotas.

Fuentes: https://vercel.com/docs/plans/hobby y
https://vercel.com/docs/spend-management.
