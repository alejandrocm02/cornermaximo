import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CareerClient } from './CareerClient';

export const metadata: Metadata = {
  title: 'Mi Carrera: crea tu futbolista y conviértete en leyenda',
  description:
    'Juego de carrera futbolística: crea un futbolista, empieza con 16 años en las categorías inferiores, toma decisiones, firma contratos y llega a la selección.',
  alternates: { canonical: '/modo-carrera' },
};

export default function ModoCarreraPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Mi Carrera' }]} />
      <div>
        <h1 className="text-2xl font-bold">Mi Carrera</h1>
        <p className="mt-1 max-w-2xl text-sm text-pitch-muted">
          De promesa a leyenda: simula una carrera completa con decisiones, partidos, contratos, lesiones y selección. Se juega
          en sesiones cortas y se guarda automáticamente en tu dispositivo.
        </p>
      </div>
      <CareerClient />
    </div>
  );
}
