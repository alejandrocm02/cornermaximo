'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className="rounded-xl border border-pitch-border bg-pitch-elevated px-4 py-2.5 text-sm font-semibold text-white transition hover:border-pitch-accent/50 disabled:opacity-60"
    >
      {loading ? 'Cerrando…' : 'Cerrar sesión'}
    </button>
  );
}
