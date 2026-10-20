import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// La página es un Client Component y no puede exportar metadata.
export const metadata: Metadata = {
  title: 'Nueva contraseña',
  description: 'Establece una nueva contraseña para tu cuenta de CornerMaximo.',
  robots: { index: false, follow: false },
};

export default function AuthSectionLayout({ children }: { children: ReactNode }) {
  return children;
}
