import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/football', () => ({
  formatMatchDate: () => '23 ago, 20:45',
  roundLabel: () => 'Jornada 1',
  statusLabel: () => 'En juego',
}));
vi.stubGlobal('React', React);

import { MatchRows } from './MatchRows';

describe('MatchRows', () => {
  it('offers a direct link to the match detail', () => {
    const html = renderToStaticMarkup(
      <MatchRows
        empty="Sin partidos"
        matches={[
          {
            id: 4141,
            kickoffAt: new Date('2026-08-23T18:45:00.000Z'),
            status: 'LIVE',
            round: 'Regular Season - 1',
            teams: [
              {
                isHome: true,
                goals: 2,
                team: { name: 'Paris Saint Germain', slug: 'paris-saint-germain' },
              },
              {
                isHome: false,
                goals: 0,
                team: { name: 'Rennes', slug: 'rennes' },
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain('href="/partidos/4141"');
    expect(html).toContain('Abrir partido →');
    expect(html).toContain('aria-label="Abrir partido Paris Saint Germain contra Rennes"');
  });
});
