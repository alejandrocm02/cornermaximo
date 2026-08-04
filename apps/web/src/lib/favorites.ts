export type FavoriteKind = 'player' | 'team' | 'competition';

export interface FavoriteItem {
  kind: FavoriteKind;
  slug: string;
  name: string;
  imageUrl: string | null;
  subtitle: string | null;
  addedAt: string;
}

const STORAGE_KEY = 'futstats.favorites.v1';
const CHANGE_EVENT = 'futstats:favorites-change';
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_FAVORITES)));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
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
