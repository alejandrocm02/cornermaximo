import { CompareClient } from './CompareClient';

export const metadata = { title: 'Comparador' };

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Comparador de jugadores</h1>
      <p className="text-sm text-pitch-muted">
        Elige dos jugadores para comparar su rendimiento en los últimos 5 partidos.
      </p>
      <CompareClient />
    </div>
  );
}
