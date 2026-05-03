import { expect, test } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico').fill('admin@agricultura.com');
    await page.getByLabel('Contraseña').fill('admin123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL('**/dashboard');
  });

  test('muestra métricas principales del dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Fincas')).toBeVisible();
    await expect(page.getByText('Lotes')).toBeVisible();
    await expect(page.getByText('Alertas sin leer')).toBeVisible();
    await expect(page.getByText('Eficiencia riego')).toBeVisible();
  });

  test('navega a reportes y muestra historial', async ({ page }) => {
    await page.getByRole('link', { name: 'Reportes' }).click();
    await expect(page).toHaveURL('**/reportes');
    await expect(page.getByRole('heading', { name: 'Reportes' })).toBeVisible();
    await expect(page.getByText('Historial de reportes')).toBeVisible();
  });

  test('navega a alertas', async ({ page }) => {
    await page.getByRole('link', { name: 'Alertas' }).click();
    await expect(page).toHaveURL('**/alertas');
    await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
  });
});
