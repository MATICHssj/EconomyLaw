import { expect, test } from '@playwright/test';

test('bienvenida → datos de ejemplo → anotar "galleta 30" → aparece en Movimientos', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page.getByRole('button', { name: 'Comenzar' }).click();
  await page.getByLabel('Tu nombre').fill('Prueba');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('radio', { name: /Organizado/ }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: /datos de ejemplo/ }).click();
  await expect(page.getByText(/Buen[oa]s/)).toBeVisible();

  await page.getByRole('button', { name: 'Anotar un gasto o ingreso' }).click();
  await page.getByLabel('¿Qué gastaste o recibiste?').fill('galleta 30');
  await expect(page.getByText('Tiendita y antojos').first()).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await page.goto('./#/movimientos');
  await expect(page.getByText('Galleta').first()).toBeVisible();

  // Ver toda la comida y un viaje de ejemplo.
  await page.goto('./#/movimientos?cat=fam:food');
  await expect(page.getByText('Toda la comida · en total')).toBeVisible();
  await page.goto('./#/viajes');
  await expect(page.getByText('Playa del Carmen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('la página de descarga muestra el botón de Android', async ({ page }) => {
  await page.goto('./descargar/index.html');
  await expect(page.getByRole('link', { name: 'Descargar para Android' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cómo instalarla' })).toBeVisible();
});
