import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { AnalizadorClient } from './AnalizadorClient';
import { AnalizadorV2Client } from './AnalizadorV2Client';

export const metadata: Metadata = {
  title: { absolute: 'Analizador de bankroll y rendimiento | CornerMaximo' },
  description:
    'Registra tus operaciones deportivas, controla varios bankrolls y analiza balance, ROI, acierto, drawdown y rendimiento por mercado.',
  alternates: { canonical: '/analizador' },
};

export default function AnalizadorPage() {
  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: 'Analizador' }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="fs-eyebrow">
            <span aria-hidden="true" className="h-1 w-4 rounded-full bg-grad-brand" />
            Gestión privada
          </p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Analizador de bankroll</h1>
          <p className="mt-2 max-w-3xl text-sm text-pitch-muted">
            Registra tus operaciones, controla la evolución de tu capital y descubre en qué mercados,
            competiciones y estrategias obtienes mejores resultados.
          </p>
        </div>
        <span className="fs-chip border-pitch-accent/40 bg-pitch-accent/10 text-pitch-accent">
          Datos solo en este dispositivo
        </span>
      </div>

      <div className="fs-panel border-pitch-warning/35 bg-pitch-warning/5 p-4 text-xs text-pitch-muted">
        CornerMaximo no es una casa de apuestas, no muestra cuotas oficiales y no procesa depósitos,
        retiradas ni dinero real. Esta herramienta sirve únicamente para registrar y analizar datos
        introducidos por ti. Las estadísticas pasadas no garantizan resultados futuros.
      </div>

      <section aria-labelledby="auditoria-analizador" className="space-y-4">
        <div>
          <p className="fs-eyebrow">Control financiero</p>
          <h2 id="auditoria-analizador" className="mt-1 text-2xl font-bold">Resumen corregido y copias de seguridad</h2>
          <p className="mt-2 text-sm text-pitch-muted">
            El ROI utiliza únicamente operaciones ganadas y perdidas. Las anuladas no consumen stake decidido.
          </p>
        </div>
        <AnalizadorV2Client />
      </section>

      <hr className="fs-rule" />

      <section aria-labelledby="gestion-operaciones" className="space-y-4">
        <div>
          <p className="fs-eyebrow">Registro</p>
          <h2 id="gestion-operaciones" className="mt-1 text-2xl font-bold">Gestión completa de operaciones</h2>
        </div>
        <AnalizadorClient />
      </section>
    </div>
  );
}
