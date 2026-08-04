import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '../AuthForm';
import { registerAction } from '../actions';

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Crea una cuenta de FutStats con tu correo electrónico.',
  alternates: { canonical: '/cuenta/registro' },
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/cuenta');
  return <AuthForm mode="register" action={registerAction} />;
}
