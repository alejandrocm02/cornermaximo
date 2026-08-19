import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('calidad web esencial', () => {
  for (const path of ['/', '/auth/login', '/pro']) {
    test(`${path} cumple las comprobaciones automatizadas WCAG 2.2 AA`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBe(true);
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  for (const viewport of [
    { width: 320, height: 800 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`sin overflow horizontal a ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const response = await page.goto('/');
      expect(response?.ok()).toBe(true);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    });
  }

  test('una ruta privada no expone contenido sin sesión', async ({ page }) => {
    await page.goto('/cuenta');
    await expect(page).toHaveURL(/\/auth\/login\?next=\/mi-corner$/);
    await expect(page.getByRole('heading', { name: /inicia sesión/i })).toBeVisible();
  });

  test('las APIs rechazan entradas inválidas y acceso administrativo anónimo', async ({ request }) => {
    const invalidPlayers = await request.get('/api/players?pageSize=0');
    expect(invalidPlayers.status()).toBe(422);
    expect(await invalidPlayers.json()).toMatchObject({ error: { code: 'INVALID_QUERY' } });

    const privateStatus = await request.get('/api/admin/sync/status');
    expect(privateStatus.status()).toBe(401);

    const unsignedWebhook = await request.post('/api/billing/webhook', { data: '{}' });
    expect(unsignedWebhook.status()).toBe(400);
  });
});

test.describe('flujos de cuenta', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Los mocks de Auth solo se ejecutan contra el build efímero de CI.');

  test('registro solicita una contraseña fuerte y confirma el envío de verificación', async ({ page }) => {
    await page.route('**/auth/v1/signup**', async (route) => {
      const body = route.request().postDataJSON() as { email?: string };
      expect(body.email).toBe('e2e@example.test');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '11111111-1111-4111-8111-111111111111',
          aud: 'authenticated',
          role: 'authenticated',
          email: body.email,
          confirmation_sent_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          identities: [],
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/auth/login');
    await page.getByRole('button', { name: 'Registrarme' }).click();
    await page.getByLabel('Correo electrónico').fill('e2e@example.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Strong-E2E-Password-2026!');
    await page.getByLabel('Repite la contraseña').fill('Strong-E2E-Password-2026!');
    await page.getByRole('button', { name: 'Crear cuenta CornerMaximo' }).click();
    await expect(page.getByRole('status')).toContainText('Revisa tu correo');
  });

  test('login presenta de forma accesible el rechazo de credenciales', async ({ page }) => {
    await page.route('**/auth/v1/token**', (route) => route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', msg: 'Credenciales no válidas' }),
    }));

    await page.goto('/auth/login');
    await page.getByLabel('Correo electrónico').fill('e2e@example.test');
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Entrar en CornerMaximo' }).click();
    await expect(page.getByText('Credenciales no válidas', { exact: true })).toBeVisible();
  });

  test('recuperación mantiene una respuesta no enumerable', async ({ page }) => {
    await page.route('**/api/auth/recovery', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.',
      }),
    }));

    await page.goto('/auth/forgot-password');
    await page.getByLabel('Correo electrónico').fill('unknown@example.test');
    await page.getByRole('button', { name: 'Enviar enlace seguro' }).click();
    await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  });

  test('exportación y borrado permanecen detrás de autenticación', async ({ page, request }) => {
    const exportResponse = await request.get('/api/account/export');
    expect(exportResponse.status()).toBe(401);

    await page.goto('/cuenta/seguridad');
    await expect(page).toHaveURL(/\/auth\/login\?next=\/cuenta\/seguridad$/);
    await expect(page.getByRole('heading', { name: /inicia sesión/i })).toBeVisible();
  });
});
