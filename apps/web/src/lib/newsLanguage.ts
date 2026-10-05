/**
 * Idioma de cada noticia, derivado del medio que la publica. Los feeds en
 * inglés cubren ligas que la prensa española trata menos, pero mezclados sin
 * distinción en una web en español resultan confusos.
 */
export const ENGLISH_NEWS_SOURCES = ['BBC Sport', 'Sky Sports'];

export type NewsLanguage = 'es' | 'en';

export function newsLanguage(source: string): NewsLanguage {
  return ENGLISH_NEWS_SOURCES.includes(source) ? 'en' : 'es';
}

/** Filtro Prisma por idioma para `NewsItem.source`. */
export function newsSourceFilter(language: NewsLanguage): { in: string[] } | { notIn: string[] } {
  return language === 'en' ? { in: ENGLISH_NEWS_SOURCES } : { notIn: ENGLISH_NEWS_SOURCES };
}
