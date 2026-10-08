import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBillingReturnUrl, getSiteUrl } from './site-url';

const SRC_DIR = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('getSiteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('prefers the production hostname Vercel exposes over the configured URL', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cornermaximo.example');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://old-name.vercel.app');

    expect(getSiteUrl()).toBe('https://cornermaximo.example');
  });

  // Tras el cambio de marca, NEXT_PUBLIC_APP_URL siguió apuntando al dominio
  // antiguo y el JSON-LD de las fichas publicaba URL que ya daban 404.
  it('is the only place that reads NEXT_PUBLIC_APP_URL', () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((path) => !path.endsWith(join('lib', 'site-url.ts')))
      .filter((path) => readFileSync(path, 'utf8').includes('NEXT_PUBLIC_APP_URL'))
      .map((path) => relative(SRC_DIR, path));

    expect(offenders).toEqual([]);
  });
});

describe('getBillingReturnUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns to the current Vercel preview deployment', () => {
    vi.stubEnv('VERCEL_TARGET_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'cornermaximo-preview.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cornermaximo.example');

    expect(getBillingReturnUrl()).toBe('https://cornermaximo-preview.vercel.app');
  });

  it('uses the stable production hostname in production', () => {
    vi.stubEnv('VERCEL_TARGET_ENV', 'production');
    vi.stubEnv('VERCEL_URL', 'cornermaximo-deployment.vercel.app');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cornermaximo.example');

    expect(getBillingReturnUrl()).toBe('https://cornermaximo.example');
  });
});
