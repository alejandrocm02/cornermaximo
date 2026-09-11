import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('historial: datos, filtros, navegación y adaptación móvil', async ({ page }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'La prueba crea datos únicamente en la base local efímera.');
  const dbUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/');
  test.skip(!['localhost', '127.0.0.1'].includes(dbUrl.hostname) || dbUrl.pathname !== '/cornermaximo', 'Requiere la base local de CI.');
  const { prisma } = await import('../packages/db/src/index');
  const prefix = `history-e2e-${Date.now()}`;
  const provider = await prisma.dataProvider.create({ data: { name: prefix } });
  const country = await prisma.country.create({ data: { name: prefix } });
  let playerId: number | undefined;
  const matchIds: number[] = [];
  try {
    const competition = await prisma.competition.create({ data: {
      externalId: prefix, providerId: provider.id, countryId: country.id,
      name: 'Liga de prueba CM', slug: prefix,
      seasons: { create: [{ year: 2026, isCurrent: true }, { year: 2025 }] },
    }, include: { seasons: true } });
    const season = competition.seasons.find((item) => item.year === 2026)!;
    const oldSeason = competition.seasons.find((item) => item.year === 2025)!;
    const previousTeam = await prisma.team.create({ data: { externalId: `${prefix}-a`, providerId: provider.id, countryId: country.id, name: 'CM Anterior', slug: `${prefix}-a` } });
    const currentTeam = await prisma.team.create({ data: { externalId: `${prefix}-b`, providerId: provider.id, countryId: country.id, name: 'CM Actual', slug: `${prefix}-b` } });
    const player = await prisma.player.create({ data: {
      externalId: prefix, providerId: provider.id, fullName: 'Jugador de prueba CM', slug: prefix,
      currentTeamId: currentTeam.id, positions: { create: { group: 'FW', isPrimary: true } },
    } });
    playerId = player.id;
    for (let i = 0; i < 8; i++) {
      const match = await prisma.match.create({ data: {
        externalId: `${prefix}-${i}`, providerId: provider.id, seasonId: i === 0 ? oldSeason.id : season.id,
        kickoffAt: new Date(i === 0 ? '2025-09-01T18:00:00Z' : `2026-09-0${i + 1}T18:00:00Z`),
        status: i === 7 ? 'LIVE' : 'FINISHED',
        teams: { create: [
          { teamId: previousTeam.id, isHome: i % 2 === 0, goals: 2 },
          { teamId: currentTeam.id, isHome: i % 2 !== 0, goals: 1 },
        ] },
        matchPlayers: { create: {
          playerId: player.id, teamId: previousTeam.id,
          role: i === 3 ? 'BENCH_UNUSED' : i === 6 ? 'SUBSTITUTE' : 'STARTER',
          minutesPlayed: i === 3 ? 0 : i === 6 ? 30 : 90, positionPlayed: 'F', rating: i === 3 ? null : 7,
          fieldStats: { create: { shotsTotal: i === 4 ? null : i === 6 ? 2 : 0, goals: 0 } },
        } },
      } });
      matchIds.push(match.id);
    }
    await page.goto(`/jugadores/${prefix}?desde=page%3D2#partido-a-partido`);
    const history = page.locator('#partido-a-partido');
    await expect(history.getByRole('columnheader')).toHaveCount(6);
    await expect(history.getByRole('row', { name: /^Tiros totales/ })).toContainText('Media: 0,67');
    await expect(history.getByRole('row', { name: /^Tiros totales/ })).toContainText('Por 90 minutos: 0,86');
    await expect(history.getByText('Sin participar', { exact: true })).toBeVisible();
    await expect(history.getByRole('link', { name: /Abrir partido/ }).first()).toHaveAttribute('href', `/partidos/${matchIds[6]}`);

    await history.getByLabel('Historial', { exact: true }).selectOption('10');
    await history.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(history.getByRole('columnheader')).toHaveCount(8);
    await expect(page).toHaveURL(/desde=page%3D2/);
    await history.getByLabel('Sede', { exact: true }).selectOption('home');
    await history.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(history.getByRole('columnheader')).toHaveCount(5);
    await expect(history.getByRole('link', { name: /Abrir partido/ }).first()).toHaveAttribute('href', `/partidos/${matchIds[6]}`);
    await history.getByLabel('Temporada', { exact: true }).selectOption('2025');
    await history.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(history.getByRole('columnheader')).toHaveCount(2);
    await history.getByLabel('Sede', { exact: true }).selectOption('away');
    await history.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(history.getByText('No hay partidos registrados para esta selección.')).toBeVisible();
    await history.getByRole('link', { name: 'Restablecer filtros' }).click();
    await expect(history.getByRole('columnheader')).toHaveCount(6);
    await expect(history.getByLabel('Historial', { exact: true })).toHaveValue('5');
    await expect(history.getByLabel('Sede', { exact: true })).toHaveValue('all');

    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    }
    const accessibility = await new AxeBuilder({ page }).include('#partido-a-partido').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(accessibility.violations).toEqual([]);
    await history.getByRole('link', { name: /Abrir partido/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/partidos/${matchIds[6]}$`));
  } finally {
    await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
    if (playerId != null) await prisma.player.delete({ where: { id: playerId } });
    await prisma.team.deleteMany({ where: { providerId: provider.id } });
    await prisma.season.deleteMany({ where: { competition: { providerId: provider.id } } });
    await prisma.competition.deleteMany({ where: { providerId: provider.id } });
    await prisma.country.delete({ where: { id: country.id } });
    await prisma.dataProvider.delete({ where: { id: provider.id } });
    await prisma.$disconnect();
  }
});
