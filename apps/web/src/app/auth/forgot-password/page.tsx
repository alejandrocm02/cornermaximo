'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { TURNSTILE_CONFIGURED, TurnstileChallenge } from '@/components/TurnstileChallenge';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRevision, setCaptchaRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captchaReady = !TURNSTILE_CONFIGURED || captchaToken != null;

  function resetCaptcha() {
    if (!TURNSTILE_CONFIGURED) return;
    setCaptchaToken(null);
    setCaptchaRevision((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!captchaReady) {
      setError('Completa la verificación anti-bot antes de continuar.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      ...(captchaToken ? { captchaToken } : {}),
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.');
    }
    setLoading(false);
    resetCaptcha();
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-2xl border border-pitch-border bg-pitch-card/80 p-6 shadow-xl sm:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-pitch-accent">Seguridad</p>
        <h1 className="font-display text-3xl font-bold text-white">Recuperar contraseña</h1>
        <p className="mt-2 text-sm leading-6 text-pitch-muted">Te enviaremos un enlace seguro para establecer una contraseña nueva.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-pitch-subtle">
            Correo electrónico
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition focus:border-pitch-accent"
            />
          </label>

          {TURNSTILE_CONFIGURED && (
            <TurnstileChallenge key={captchaRevision} onToken={setCaptchaToken} />
          )}

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          {message && <p role="status" className="rounded-xl border border-pitch-accent/30 bg-pitch-accent/10 px-4 py-3 text-sm text-pitch-accent">{message}</p>}

          <button
            type="submit"
            disabled={loading || !captchaReady}
            className="w-full rounded-xl bg-grad-brand px-4 py-3 font-display font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/auth/login" className="text-sm font-medium text-pitch-accent hover:underline">Volver a iniciar sesión</Link>
        </div>
      </div>
    </section>
  );
}
