import { Suspense } from 'react';
import { AdvancedComparison } from '@/components/AdvancedComparison';
import { CompareClient } from './CompareClient';

export const metadata = {
  title: { absolute: 'Comparador de futbolistas y rendimiento | FutStats' },
  description:
    'Compara futbolistas por rendimiento reciente, métricas por 90 y percentiles posicionales de temporada.',
  alternates: { canonical: '/comparador' },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ p1?: string; p2?: string }>;
}) {
  const { p1, p2 } = await searchParams;

  return (
    <div className="space-y-8">
      <div>
        <p className="fs-eyebrow">Comparador FutStats</p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Comparador de jugadores</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-pitch-muted">
          Compara una ventana reciente de partidos y, cuando eliges dos jugadores, añade una segunda capa con métricas por 90 y percentiles de temporada. El enlace mantiene la selección y se puede compartir.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-pitch-muted">Cargando comparador…</p>}>
        <CompareClient />
      </Suspense>
      <Suspense fallback={<div className="h-48 animate-pulse fs-panel" />}>
        <AdvancedComparison p1={p1} p2={p2} />
      </Suspense>
    </div>
  );
}
