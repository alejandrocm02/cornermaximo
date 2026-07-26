export const metadata = {
  title: 'Política de privacidad',
  description: 'Política de privacidad de FutStats.',
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold sm:text-4xl">Política de privacidad</h1>
      <p className="text-sm leading-relaxed text-pitch-muted">
        FutStats no requiere registro y no recopila datos personales de sus visitantes. No se
        utilizan cookies propias de seguimiento ni herramientas de analítica en esta versión.
      </p>
      <p className="rounded-lg border border-dashed border-pitch-border p-3 text-xs text-pitch-muted">
        Documento en preparación. Pendiente de definir: responsable del tratamiento y vía de
        contacto. Esta página se completará antes de incorporar cualquier tratamiento de datos
        personales (cuentas de usuario, analítica o publicidad).
      </p>
    </article>
  );
}
