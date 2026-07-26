import { Suspense } from 'react';
import { CompareClient } from './CompareClient';

export const metadata = {
  title: { absolute: 'Comparador de futbolistas y rendimiento | FutStats' },
  description:
    'Compara el rendimiento reciente de dos futbolistas por goles, asistencias, minutos y otras métricas disponibles.',
  alternates: { canonical: '/comparador' },
};

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold sm:text-4xl">Comparador de jugadores</h1>
      <p className="max-w-2xl text-sm text-pitch-muted">
        Compara el rendimiento reciente de dos futbolistas por goles, asistencias, minutos y otras
        métricas disponibles. El enlace de la comparación se puede compartir.
      </p>
      <Suspense fallback={<p className="text-sm text-pitch-muted">Cargando comparador…</p>}>
        <CompareClient />
      </Suspense>
    </div>
  );
}
