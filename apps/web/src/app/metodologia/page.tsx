export const metadata = {
  title: 'Fuente y metodología',
  description: 'De dónde salen los datos de FutStats y cómo se calculan las métricas: totales, medias por partido, por 90 minutos y tendencias.',
};

export default function MethodologyPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Fuente y metodología</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Fuente de los datos</h2>
        <p className="text-sm leading-relaxed text-pitch-muted">
          Todos los datos deportivos proceden de API-Football (api-football.com), con actualización
          automática cada hora. Cada partido finalizado recibe además una segunda pasada de
          verificación 24 horas después para incorporar correcciones del proveedor. Algunas
          competiciones pueden presentar retrasos respecto a la fuente original.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cálculo de métricas</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-pitch-muted">
          <li>Media por partido: total dividido entre partidos con minutos disputados.</li>
          <li>Valor por 90 minutos: total dividido entre minutos jugados y multiplicado por 90.</li>
          <li>
            Tendencias: comparación de los últimos 5 partidos con los 5 anteriores por 90 minutos,
            con un mínimo de 180 minutos por ventana y una banda de estabilidad del ±10&nbsp;%. Si no
            hay muestra suficiente, se indica explícitamente.
          </li>
          <li>
            Un dato ausente en la fuente se muestra como «—» y nunca se interpreta como cero ni se
            inventa.
          </li>
          <li>Los convocados sin minutos no cuentan como partidos jugados.</li>
        </ul>
      </section>
    </article>
  );
}
