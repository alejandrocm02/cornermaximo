export const CONSENT_STORAGE_KEY = 'futstats.consent.v1';
export const CONSENT_VERSION = 1;

export type ConsentPreferences = {
  version: number;
  decidedAt: string;
  analytics: boolean;
  advertising: boolean;
};

export const DEFAULT_CONSENT: ConsentPreferences = {
  version: CONSENT_VERSION,
  decidedAt: '',
  analytics: false,
  advertising: false,
};

export function readConsent(): ConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.advertising !== 'boolean') return null;
    return {
      version: CONSENT_VERSION,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : '',
      analytics: parsed.analytics,
      advertising: parsed.advertising,
    };
  } catch {
    return null;
  }
}

export function writeConsent(input: Pick<ConsentPreferences, 'analytics' | 'advertising'>): ConsentPreferences {
  const value: ConsentPreferences = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    analytics: input.analytics,
    advertising: input.advertising,
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Si el almacenamiento está bloqueado, la preferencia no puede persistir y el banner reaparecerá.
  }
  window.dispatchEvent(new CustomEvent('futstats:consent-change', { detail: value }));
  return value;
}

export function hasConsent(category: 'analytics' | 'advertising'): boolean {
  return readConsent()?.[category] === true;
}
