'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  clearFavoriteCacheAfterSignOut,
  syncFavoritesWithAccount,
} from '@/lib/favorites';
import { clearSyncedAccountCachesAfterSignOut } from '@/lib/useSyncedAccountState';
import { getSupabaseClient, hasSupabaseSessionCookie } from '@/lib/supabase/lazyClient';

export function FavoritesAccountSync() {
  const pathname = usePathname();
  const unsubscribe = useRef<(() => void) | null>(null);

  // Sin sesión no se descarga el SDK de Supabase. Se vuelve a comprobar en
  // cada navegación porque el login redirige en cliente (sin recargar la
  // página): en cuanto aparece la cookie de sesión, se sincroniza y se empieza
  // a escuchar el cierre de sesión.
  useEffect(() => {
    if (unsubscribe.current != null || !hasSupabaseSessionCookie()) return;

    let cancelled = false;
    unsubscribe.current = () => {
      cancelled = true;
    };

    void syncFavoritesWithAccount();

    void getSupabaseClient().then((supabase) => {
      if (cancelled) return;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          clearFavoriteCacheAfterSignOut();
          clearSyncedAccountCachesAfterSignOut();
          return;
        }

        if (session?.user != null) {
          // Keep the auth callback synchronous; run account I/O after Supabase finishes
          // processing the auth event to avoid re-entrant auth calls.
          window.setTimeout(() => {
            void syncFavoritesWithAccount();
          }, 0);
        }
      });
      unsubscribe.current = () => data.subscription.unsubscribe();
    });
  }, [pathname]);

  useEffect(
    () => () => {
      unsubscribe.current?.();
      unsubscribe.current = null;
    },
    [],
  );

  return null;
}
