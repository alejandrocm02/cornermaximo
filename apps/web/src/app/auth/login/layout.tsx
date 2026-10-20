import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// La página es un Client Component y no puede exportar metadata.
export const metadata: Metadata = {
  title: 'Iniciar sesión o crear cuenta',
  description: 'Accede a Mi Corner para sincronizar favoritos, watchlists, alertas y comparaciones.',
  robots: { index: false, follow: false },
};

export default function AuthSectionLayout({ children }: { children: ReactNode }) {
  return children;
}
