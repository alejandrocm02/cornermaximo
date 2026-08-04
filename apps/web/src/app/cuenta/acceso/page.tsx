import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '../AuthForm';
import { loginAction } from '../actions';

export const metadata: Metadata = {
  title: 'Iniciar sesión',
  description: 'Accede a tu cuenta de FutStats.',
  alternates: { canonical: '/cuenta/acceso' },
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/cuenta');
  return <AuthForm mode="login" action={loginAction} />;
}
