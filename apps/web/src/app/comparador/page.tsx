import { Suspense } from 'react';
import { AdvancedComparison } from '@/components/AdvancedComparison';
import { CompareClient } from './CompareClient';

export const metadata = {
  title: { absolute: 'CM Compare | CornerMaximo' },
  description: 'Compara futbolistas por rendimiento reciente, métricas por 90 y percentiles posicionales con CornerMaximo Sports Intelligence.',
  alternates: { canonical: '/comparador' },
};

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ p1?: string; p2?: string }> }) {
  const { p1, p2 } = await searchParams;
  return <div className="space-y-8">
    <header className="fs-panel relative overflow-hidden p-6 sm:p-8">
      <div aria-hidden="true" className="absolute -right-12 -top-16 h-56 w-56 rounded-full bg-pitch-accent/10 blur-3xl" />
      <div className="relative max-w-3xl"><p className="fs-eyebrow">CORNERMAXIMO · CM COMPARE</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Jugador vs Jugador</h1><p className="mt-3 text-sm leading-6 text-pitch-muted sm:text-base">Contrasta rendimiento reciente y añade contexto con métricas por 90 y percentiles posicionales. La selección queda en la URL para compartir el análisis.</p></div>
    </header>
    <Suspense fallback={<div className="fs-panel h-28 animate-pulse" />}><CompareClient /></Suspense>
    <Suspense fallback={<div className="fs-panel h-48 animate-pulse" />}><AdvancedComparison p1={p1} p2={p2} /></Suspense>
  </div>;
}
