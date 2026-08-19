'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      setError('No se pudieron cerrar todas las sesiones. Inténtalo de nuevo.');
      setLoading(false);
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return <div className="text-right">
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="rounded-xl border border-pitch-border bg-pitch-elevated px-4 py-2.5 text-sm font-semibold text-white transition hover:border-pitch-accent/50 disabled:opacity-60"
    >
      {loading ? 'Cerrando…' : 'Cerrar todas las sesiones'}
    </button>
    {error && <p role="alert" className="mt-2 max-w-xs text-xs text-pitch-danger">{error}</p>}
  </div>;
}
