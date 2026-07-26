export const metadata = {
  title: 'Sobre FutStats',
  description: 'Qué es FutStats: base de datos y análisis de rendimiento de futbolistas de las grandes ligas y el Mundial 2026.',
};

export default function AboutPage() {
  return (
    <article className="prose-invert max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold sm:text-4xl">Sobre FutStats</h1>
      <p className="text-sm leading-relaxed text-pitch-muted">
        FutStats es una plataforma de estadísticas de fútbol centrada en el rendimiento reciente de
        los jugadores: sus últimos partidos, medias por partido y por 90 minutos, rankings y
        comparaciones directas. Cubre las cinco grandes ligas europeas (temporadas 2025-26 y
        2026-27) y la Copa Mundial de la FIFA 2026.
      </p>
      <p className="text-sm leading-relaxed text-pitch-muted">
        Los datos se sincronizan automáticamente cada hora desde API-Football. Consulta la{' '}
        <a href="/metodologia" className="text-pitch-accent hover:underline">metodología</a> para
        saber cómo se calculan las métricas.
      </p>
      <p className="rounded-lg border border-dashed border-pitch-border p-3 text-xs text-pitch-muted">
        Canal de contacto y reporte de errores: pendiente de definir. Cuando exista una vía
        pública se publicará en esta página.
      </p>
    </article>
  );
}
