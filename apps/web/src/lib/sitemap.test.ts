import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  player: { findMany: vi.fn() },
  team: { findMany: vi.fn() },
  competition: { findMany: vi.fn() },
  match: { findMany: vi.fn() },
}));

vi.mock('@cornermaximo/db', () => ({ prisma: db }));

const { getSitemapEntries, renderSitemapXml, SITEMAP_CACHE_CONTROL } = await import('./sitemap');
const { GET } = await import('@/app/sitemap.xml/route');

const updated = new Date('2026-10-20T01:27:20.000Z');

function seed() {
  db.player.findMany.mockResolvedValue([{ slug: 'j-bellingham', updatedAt: updated }]);
  db.team.findMany.mockResolvedValue([{ slug: 'real-madrid', updatedAt: updated }]);
  db.competition.findMany.mockResolvedValue([{ slug: 'laliga', updatedAt: updated }]);
  db.match.findMany.mockResolvedValue([{ id: 7899, updatedAt: updated }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('renderSitemapXml', () => {
  it('genera URLs absolutas con lastmod en ISO', () => {
    const xml = renderSitemapXml('https://cornermaximo.es/', [
      { path: '', priority: 1 },
      { path: '/jugadores/j-bellingham', lastModified: updated, changeFrequency: 'daily', priority: 0.85 },
    ]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<loc>https://cornermaximo.es</loc>');
    expect(xml).toContain('<loc>https://cornermaximo.es/jugadores/j-bellingham</loc>');
    expect(xml).toContain('<lastmod>2026-10-20T01:27:20.000Z</lastmod>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
  });

  it('escapa caracteres reservados de XML', () => {
    const xml = renderSitemapXml('https://cornermaximo.es', [{ path: '/buscar?a=1&b=<2>' }]);
    expect(xml).toContain('<loc>https://cornermaximo.es/buscar?a=1&amp;b=&lt;2&gt;</loc>');
  });

  it('omite lastmod si la fecha no es válida', () => {
    const xml = renderSitemapXml('https://cornermaximo.es', [{ path: '/x', lastModified: new Date('nope') }]);
    expect(xml).not.toContain('<lastmod>');
  });
});

describe('getSitemapEntries', () => {
  it('incluye rutas estáticas, ligas, equipos, jugadores y partidos recientes', async () => {
    seed();
    const entries = await getSitemapEntries(new Date('2026-10-20T10:00:00Z'));
    const paths = entries.map((entry) => entry.path);

    expect(paths).toEqual(
      expect.arrayContaining(['', '/jugadores', '/ligas/laliga', '/equipos/real-madrid', '/jugadores/j-bellingham', '/partidos/7899']),
    );
    const matchQuery = db.match.findMany.mock.calls[0]![0] as { where: { kickoffAt: { gte: Date } } };
    expect(matchQuery.where.kickoffAt.gte.toISOString()).toBe('2026-07-22T10:00:00.000Z');
  });
});

describe('GET /sitemap.xml', () => {
  it('responde XML cacheable en la CDN', async () => {
    seed();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(response.headers.get('Cache-Control')).toBe(SITEMAP_CACHE_CONTROL);
    expect(await response.text()).toContain('/jugadores/j-bellingham</loc>');
  });

  it('devuelve 503 sin caché si la base de datos falla, en vez de un sitemap recortado', async () => {
    seed();
    db.player.findMany.mockRejectedValue(new Error('quota exceeded'));
    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Retry-After')).toBe('3600');
  });
});
