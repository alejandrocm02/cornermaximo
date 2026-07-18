import { Suspense } from 'react';
import { CompareClient } from './CompareClient';

export const metadata = { title: 'Comparador' };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Comparador de jugadores</h1>
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
