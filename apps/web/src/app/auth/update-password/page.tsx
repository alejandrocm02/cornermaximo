'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.replace('/cuenta?password=updated');
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-md">
      <div className="rounded-2xl border border-pitch-border bg-pitch-card/80 p-6 shadow-xl sm:p-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-pitch-accent">Seguridad</p>
        <h1 className="font-display text-3xl font-bold text-white">Nueva contraseña</h1>
        <p className="mt-2 text-sm leading-6 text-pitch-muted">Utiliza una contraseña única que no uses en otros servicios.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-pitch-subtle">
            Nueva contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition focus:border-pitch-accent"
            />
          </label>
          <label className="block text-sm font-medium text-pitch-subtle">
            Repite la contraseña
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-pitch-border bg-pitch-bg px-4 py-3 text-white outline-none transition focus:border-pitch-accent"
            />
          </label>

          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-grad-brand px-4 py-3 font-display font-bold text-black disabled:opacity-60">
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </section>
  );
}
