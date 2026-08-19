'use client';

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AccountStateKey = 'analyzer' | 'comparisons';
export type AccountSyncStatus = 'loading' | 'local' | 'syncing' | 'synced' | 'error';

const MAX_CLIENT_PAYLOAD_BYTES = 900_000;
const OWNER_SUFFIX = '.account-owner';
const DIRTY_SUFFIX = '.account-dirty';
const EMPTY_LEGACY_STORAGE_KEYS: string[] = [];

const ACCOUNT_STORAGE_KEYS = [
  'cornermaximo.analizador.v1',
  'cornermaximo.comparisons.v1',
] as const;

interface RemoteState {
  payload: unknown;
  revision: number;
  updated_at: string;
}

interface Options<T extends object> {
  stateKey: AccountStateKey;
  storageKey: string;
  legacyStorageKeys?: string[];
  loadLocal: () => T;
  isValid: (value: unknown) => value is T;
}

interface Result<T extends object> {
  state: T | null;
  setState: Dispatch<SetStateAction<T | null>>;
  authenticated: boolean;
  status: AccountSyncStatus;
  error: string | null;
}

function ownerKey(storageKey: string): string {
  return `${storageKey}${OWNER_SUFFIX}`;
}

function dirtyKey(storageKey: string): string {
  return `${storageKey}${DIRTY_SUFFIX}`;
}

function clearOwnedLocalState(storageKey: string): void {
  localStorage.removeItem(storageKey);
  localStorage.removeItem(ownerKey(storageKey));
  localStorage.removeItem(dirtyKey(storageKey));
}

export function clearSyncedAccountCachesAfterSignOut(): void {
  for (const storageKey of ACCOUNT_STORAGE_KEYS) {
    if (localStorage.getItem(ownerKey(storageKey)) != null) clearOwnedLocalState(storageKey);
  }
}

export function useSyncedAccountState<T extends object>({
  stateKey,
  storageKey,
  legacyStorageKeys = EMPTY_LEGACY_STORAGE_KEYS,
  loadLocal,
  isValid,
}: Options<T>): Result<T> {
  const [state, setState] = useState<T | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState<AccountSyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const ready = useRef(false);
  const skipNextPersist = useRef(false);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let localOwner = localStorage.getItem(ownerKey(storageKey));

      if (!user && localOwner != null) {
        clearOwnedLocalState(storageKey);
        localOwner = null;
      }
      if (user && localOwner != null && localOwner !== user.id) {
        clearOwnedLocalState(storageKey);
        localOwner = null;
      }

      const hadLocalState = localStorage.getItem(storageKey) != null ||
        legacyStorageKeys.some((key) => localStorage.getItem(key) != null);
      const localState = loadLocal();

      if (!user) {
        if (!active) return;
        skipNextPersist.current = true;
        setState(localState);
        setAuthenticated(false);
        setStatus('local');
        ready.current = true;
        return;
      }

      const remoteResult = await supabase
        .from('user_app_state')
        .select('payload,revision,updated_at')
        .eq('user_id', user.id)
        .eq('state_key', stateKey)
        .maybeSingle();

      if (remoteResult.error) {
        if (!active) return;
        skipNextPersist.current = true;
        setState(localState);
        setAuthenticated(true);
        setStatus('error');
        setError('No se pudo descargar el estado de tu cuenta. La copia local sigue disponible.');
        ready.current = true;
        return;
      }

      const remote = remoteResult.data as RemoteState | null;
      const remoteIsValid = remote != null && isValid(remote.payload);
      const localIsDirty = localStorage.getItem(dirtyKey(storageKey)) === '1';
      const shouldImportLocal = hadLocalState && localOwner == null;
      let chosen = remoteIsValid ? remote.payload : localState;
      let syncFailed = false;

      if (localIsDirty || shouldImportLocal || !remoteIsValid) {
        const serialized = JSON.stringify(localState);
        if (new TextEncoder().encode(serialized).byteLength <= MAX_CLIENT_PAYLOAD_BYTES) {
          const writeResult = await supabase.rpc('save_user_app_state', {
            p_state_key: stateKey,
            p_payload: localState,
          });
          if (!active) return;
          if (!writeResult.error) {
            chosen = localState;
            localStorage.removeItem(dirtyKey(storageKey));
          } else {
            syncFailed = true;
            localStorage.setItem(dirtyKey(storageKey), '1');
            setError('La copia local está guardada, pero todavía no se pudo sincronizar.');
          }
        } else {
          syncFailed = true;
          setError('La copia local es demasiado grande para sincronizarla. Exporta y reduce sus datos.');
        }
      }

      if (!active) return;
      localStorage.setItem(storageKey, JSON.stringify(chosen));
      localStorage.setItem(ownerKey(storageKey), user.id);
      skipNextPersist.current = true;
      setState(chosen as T);
      setAuthenticated(true);
      setStatus(syncFailed ? 'error' : 'synced');
      ready.current = true;
    }

    void initialize().catch(() => {
      if (!active) return;
      skipNextPersist.current = true;
      setState(loadLocal());
      setStatus('error');
      setError('No se pudo iniciar la sincronización. La copia local sigue disponible.');
      ready.current = true;
    });

    return () => {
      active = false;
    };
  }, [isValid, legacyStorageKeys, loadLocal, stateKey, storageKey]);

  useEffect(() => {
    if (!ready.current || state == null) return;
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }

    const serialized = JSON.stringify(state);
    localStorage.setItem(storageKey, serialized);
    if (!authenticated) {
      setStatus('local');
      return;
    }

    localStorage.setItem(dirtyKey(storageKey), '1');
    setStatus('syncing');
    setError(null);
    let active = true;

    const timer = window.setTimeout(async () => {
      if (new TextEncoder().encode(serialized).byteLength > MAX_CLIENT_PAYLOAD_BYTES) {
        if (!active) return;
        setStatus('error');
        setError('Este estado supera el límite de sincronización. Exporta y reduce sus datos.');
        return;
      }

      const supabase = createClient();
      const { error: writeError } = await supabase.rpc('save_user_app_state', {
        p_state_key: stateKey,
        p_payload: state,
      });
      if (!active) return;
      if (writeError) {
        setStatus('error');
        setError('Cambios guardados localmente; se reintentará la sincronización al volver.');
        return;
      }

      if (localStorage.getItem(storageKey) === serialized) {
        localStorage.removeItem(dirtyKey(storageKey));
        setStatus('synced');
      }
    }, 700);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [authenticated, state, stateKey, storageKey]);

  return { state, setState, authenticated, status, error };
}
