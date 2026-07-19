import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { MisApuestasClient } from '@/components/apuestas/MisApuestasClient';

export const metadata: Metadata = {
  title: { absolute: 'Mis apuestas simuladas | FutStats' },
  description: 'Historial privado de simulaciones de apuestas guardadas en este navegador.',
  // Historial personal: nunca indexable
  robots: { index: false, follow: false },
};

export default function MisApuestasPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Apuestas', href: '/apuestas' }, { label: 'Mis apuestas' }]} />
      <div>
        <h1 className="text-2xl font-bold">Mis apuestas e historial</h1>
        <p className="mt-1 max-w-2xl text-sm text-pitch-muted">
          Simulaciones guardadas en este navegador, con seguimiento de resultados según el marcador
          final registrado en FutStats.
        </p>
      </div>
      <MisApuestasClient />
    </div>
  );
}
