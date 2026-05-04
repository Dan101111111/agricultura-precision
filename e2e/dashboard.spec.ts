import { expect, test } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@agricultura.com');
    await page.getByLabel('Contraseña').fill('admin123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('muestra métricas principales del dashboard', async ({ page }) => {
    const main = page.getByRole('main')
    await expect(page.getByRole('heading', { level: 1, name: /Dashboard/i })).toBeVisible();
    await expect(main.getByText('Alertas sin leer', { exact: true })).toBeVisible();
    await expect(main.getByText('Eficiencia riego', { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Fincas', exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Ver Alertas', exact: true })).toBeVisible();
  });

  test('navega a reportes y muestra historial', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/reportes$/);
    await expect(page.getByRole('heading', { level: 1, name: /Reportes/i })).toBeVisible();
    await expect(page.getByText('Historial de reportes')).toBeVisible();
  });

  test('navega a alertas', async ({ page }) => {
    await page.getByRole('navigation').getByRole('link', { name: 'Alertas', exact: true }).click();
    await expect(page).toHaveURL(/\/alertas$/);
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
  });
});
