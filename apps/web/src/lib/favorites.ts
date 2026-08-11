import { createClient } from '@/lib/supabase/client';

export type FavoriteKind = 'player' | 'team' | 'competition';
export type FavoriteStorageMode = 'local' | 'account';

export interface FavoriteItem {
  kind: FavoriteKind;
  slug: string;
  name: string;
  imageUrl: string | null;
  subtitle: string | null;
  addedAt: string;
}

export interface FavoriteSyncResult {
  items: FavoriteItem[];
  mode: FavoriteStorageMode;
  error: string | null;
}

interface FavoriteRow {
  kind: FavoriteKind;
  entity_slug: string;
  display_name: string;
  image_url: string | null;
  subtitle: string | null;
  added_at: string;
}

const STORAGE_KEY = 'cornermaximo.favorites.v1';
const CHANGE_EVENT = 'cornermaximo:favorites-change';
const MIGRATION_KEY_PREFIX = 'cornermaximo.favorites.account-migrated.v1';
const MAX_FAVORITES = 60;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validItem(value: unknown): value is FavoriteItem {
  if (value == null || typeof value !== 'object') return false;
  const item = value as Partial<FavoriteItem>;
  return (
    (item.kind === 'player' || item.kind === 'team' || item.kind === 'competition') &&
    typeof item.slug === 'string' &&
    SLUG_PATTERN.test(item.slug) &&
    typeof item.name === 'string' &&
    item.name.trim() !== '' &&
    (item.imageUrl == null || typeof item.imageUrl === 'string') &&
    (item.subtitle == null || typeof item.subtitle === 'string') &&
    typeof item.addedAt === 'string'
  );
}

function migrationKey(userId: string): string {
  return `${MIGRATION_KEY_PREFIX}:${userId}`;
}

function dispatchFavoritesChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function readFavorites(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validItem).slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_FAVORITES)));
  dispatchFavoritesChange();
}

function rowToFavorite(row: FavoriteRow): FavoriteItem {
  return {
    kind: row.kind,
    slug: row.entity_slug,
    name: row.display_name,
    imageUrl: row.image_url,
    subtitle: row.subtitle,
    addedAt: row.added_at,
  };
}

function itemToRow(item: FavoriteItem, userId: string) {
  return {
    user_id: userId,
    kind: item.kind,
    entity_slug: item.slug,
    display_name: item.name,
    image_url: item.imageUrl,
    subtitle: item.subtitle,
    added_at: item.addedAt,
  };
}

async function readAccountFavorites(userId: string): Promise<{ items: FavoriteItem[]; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_favorites')
    .select('kind, entity_slug, display_name, image_url, subtitle, added_at')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
    .limit(MAX_FAVORITES);

  if (error) return { items: [], error: error.message };
  return { items: ((data ?? []) as FavoriteRow[]).map(rowToFavorite), error: null };
}

export function favoriteKey(item: Pick<FavoriteItem, 'kind' | 'slug'>): string {
  return `${item.kind}:${item.slug}`;
}

export function hasFavorite(item: Pick<FavoriteItem, 'kind' | 'slug'>): boolean {
  const key = favoriteKey(item);
  return readFavorites().some((favorite) => favoriteKey(favorite) === key);
}

export function toggleFavorite(
  item: Omit<FavoriteItem, 'addedAt'>,
): { active: boolean; items: FavoriteItem[] } {
  const current = readFavorites();
  const key = favoriteKey(item);
  const exists = current.some((favorite) => favoriteKey(favorite) === key);
  const items = exists
    ? current.filter((favorite) => favoriteKey(favorite) !== key)
    : [{ ...item, addedAt: new Date().toISOString() }, ...current].slice(0, MAX_FAVORITES);

  writeFavorites(items);
  return { active: !exists, items };
}

export function removeFavorite(item: Pick<FavoriteItem, 'kind' | 'slug'>): FavoriteItem[] {
  const key = favoriteKey(item);
  const items = readFavorites().filter((favorite) => favoriteKey(favorite) !== key);
  writeFavorites(items);
  return items;
}

export function clearFavorites(): void {
  if (typeof window === 'undefined') return;
  writeFavorites([]);
}

export async function syncFavoritesWithAccount(): Promise<FavoriteSyncResult> {
  const localItems = readFavorites();
  if (typeof window === 'undefined') return { items: localItems, mode: 'local', error: null };

  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user == null) {
    return { items: localItems, mode: 'local', error: null };
  }

  const userId = authData.user.id;
  let account = await readAccountFavorites(userId);
  if (account.error != null) {
    return { items: localItems, mode: 'account', error: account.error };
  }

  const alreadyMigrated = window.localStorage.getItem(migrationKey(userId)) === '1';
  if (!alreadyMigrated && localItems.length > 0) {
    const { error } = await supabase
      .from('user_favorites')
      .upsert(localItems.map((item) => itemToRow(item, userId)), {
        onConflict: 'user_id,kind,entity_slug',
      });

    if (error) return { items: localItems, mode: 'account', error: error.message };

    account = await readAccountFavorites(userId);
    if (account.error != null) {
      return { items: localItems, mode: 'account', error: account.error };
    }
  }

  window.localStorage.setItem(migrationKey(userId), '1');
  writeFavorites(account.items);
  return { items: account.items, mode: 'account', error: null };
}

export async function persistFavoriteForCurrentUser(
  item: Omit<FavoriteItem, 'addedAt'>,
  active: boolean,
): Promise<{ mode: FavoriteStorageMode; error: string | null }> {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user == null) return { mode: 'local', error: null };

  const userId = authData.user.id;
  if (active) {
    const stored = readFavorites().find(
      (favorite) => favorite.kind === item.kind && favorite.slug === item.slug,
    );
    const favorite: FavoriteItem = stored ?? { ...item, addedAt: new Date().toISOString() };
    const { error } = await supabase
      .from('user_favorites')
      .upsert(itemToRow(favorite, userId), { onConflict: 'user_id,kind,entity_slug' });
    return { mode: 'account', error: error?.message ?? null };
  }

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('kind', item.kind)
    .eq('entity_slug', item.slug);
  return { mode: 'account', error: error?.message ?? null };
}

export async function removeFavoriteForCurrentUser(
  item: Pick<FavoriteItem, 'kind' | 'slug'>,
): Promise<{ items: FavoriteItem[]; mode: FavoriteStorageMode; error: string | null }> {
  const items = removeFavorite(item);
  const result = await persistFavoriteForCurrentUser(
    { kind: item.kind, slug: item.slug, name: item.slug, imageUrl: null, subtitle: null },
    false,
  );
  return { items, ...result };
}

export async function clearFavoritesForCurrentUser(): Promise<{
  mode: FavoriteStorageMode;
  error: string | null;
}> {
  clearFavorites();
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user == null) return { mode: 'local', error: null };

  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', authData.user.id);
  return { mode: 'account', error: error?.message ?? null };
}

export function clearFavoriteCacheAfterSignOut(): void {
  clearFavorites();
}

export function subscribeFavorites(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}
