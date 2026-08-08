'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { createClient } from '@/lib/supabase/client';
import {
  getPasswordValidationError,
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
} from '@/lib/auth/passwordPolicy';

type Mode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const registrationPasswordValid = isPasswordValid(password);
  const passwordsMatch = password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === 'register') {
      const passwordError = getPasswordValidationError(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }

      if (!passwordsMatch) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const callbackUrl = `${window.location.origin}/auth/callback`;
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: callbackUrl },
        });

        if (signUpError) throw signUpError;
        setMessage('Cuenta creada. Revisa tu correo para confirmar el registro.');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;

        const next = searchParams.get('next');
        router.replace(next && next.startsWith('/') ? next : '/cuenta');
        router.refresh();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se ha podido completar la autenticación.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-2xl border border-pitch-border bg-pitch-card/80 p-6 shadow-xl sm:p-8">
        <div className="mb-6">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-pitch-accent">FutStats ID</p>
          <h1 className="font-display text-3xl font-bold text-white">
            {mode === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-pitch-muted">
            Guarda favoritos, comparaciones y preferencias de forma segura.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl border border-pitch-border bg-pitch-bg/60 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setConfirmPassword('');
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-pitch-elevated text-white' : 'text-pitch-muted hover:text-white'}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
              setMessage(null);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === 'register' ? 'bg-pitch-elevated text-white' : 'text-pitch-muted hover:text-white'}`}
          >
            Registrarme
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-pitch-subtle">
            Correo electrónico
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition placeholder:text-pitch-muted focus:border-pitch-accent"
              placeholder="tu@email.com"
            />
          </label>

          <label className="block text-sm font-medium text-pitch-subtle">
            Contraseña
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? PASSWORD_MIN_LENGTH : undefined}
              aria-describedby={mode === 'register' ? 'password-requirements' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition placeholder:text-pitch-muted focus:border-pitch-accent"
              placeholder={mode === 'login' ? 'Tu contraseña' : '10+ caracteres con mayúscula, número y símbolo'}
            />
          </label>

          {mode === 'register' && (
            <div id="password-requirements">
              <PasswordRequirements password={password} />
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-pitch-subtle">
                Repite la contraseña
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition placeholder:text-pitch-muted focus:border-pitch-accent"
                  placeholder="Repite tu contraseña"
                />
              </label>
              {confirmPassword && (
                <p
                  aria-live="polite"
                  className={`mt-2 text-sm ${passwordsMatch ? 'text-pitch-accent' : 'text-pitch-muted'}`}
                >
                  {passwordsMatch ? '✓ Las contraseñas coinciden.' : 'Las contraseñas todavía no coinciden.'}
                </p>
              )}
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-pitch-accent/30 bg-pitch-accent/10 px-4 py-3 text-sm text-pitch-accent">{message}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && (!registrationPasswordValid || !passwordsMatch))}
            className="w-full rounded-xl bg-grad-brand px-4 py-3 font-display font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Procesando…' : mode === 'login' ? 'Entrar en FutStats' : 'Crear cuenta'}
          </button>
        </form>

        {mode === 'login' && (
          <div className="mt-5 text-center">
            <Link href="/auth/forgot-password" className="text-sm font-medium text-pitch-accent hover:underline">
              ¿Has olvidado la contraseña?
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
