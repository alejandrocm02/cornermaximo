'use client';

import { useEffect } from 'react';
import {
  clearFavoriteCacheAfterSignOut,
  syncFavoritesWithAccount,
} from '@/lib/favorites';
import { clearSyncedAccountCachesAfterSignOut } from '@/lib/useSyncedAccountState';
import { createClient } from '@/lib/supabase/client';

export function FavoritesAccountSync() {
  useEffect(() => {
    const supabase = createClient();

    void syncFavoritesWithAccount();

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

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
