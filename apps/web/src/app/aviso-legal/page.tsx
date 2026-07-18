export const metadata = {
  title: 'Aviso legal',
  description: 'Aviso legal de FutStats.',
  robots: { index: false },
};

export default function LegalPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Aviso legal</h1>
      <p className="text-sm leading-relaxed text-pitch-muted">
        FutStats es un proyecto de análisis estadístico de fútbol. Los datos deportivos proceden de
        API-Football. Los nombres de competiciones y clubes, sus escudos y las fotografías de
        jugadores pertenecen a sus respectivos titulares y se muestran únicamente con fines
        informativos. FutStats no está afiliado a la FIFA, a las ligas ni a los clubes mostrados.
      </p>
      <p className="rounded-lg border border-dashed border-pitch-border p-3 text-xs text-pitch-muted">
        Documento en preparación. Pendiente de definir: titular responsable del sitio y datos de
        contacto. No se publica información ficticia.
      </p>
    </article>
  );
}
