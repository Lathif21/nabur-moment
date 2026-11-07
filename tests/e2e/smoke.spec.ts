import { expect, test, type Page } from '@playwright/test';

/** Buttons only work after hydration; on a cold dev server that can take a moment */
async function hydrated(page: Page) {
	await page.waitForLoadState('networkidle');
}

test('home page renders in Bahasa Indonesia', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Momen');
	await expect(page.locator('html')).toHaveAttribute('lang', 'id');
});

test('public nav routes to placeholders, unknown paths are 404', async ({ page }) => {
	await page.goto('/paket');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Paket');
	const res = await page.goto('/tidak-ada');
	expect(res?.status()).toBe(404);
});

test('admin sidebar links route to placeholders', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/admin');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
	await page
		.getByRole('navigation', { name: 'Menu admin' })
		.getByRole('link', { name: 'Kalender' })
		.click();
	await expect(page).toHaveURL(/\/admin\/kalender$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kalender');
	const res = await page.goto('/admin/tidak-ada');
	expect(res?.status()).toBe(404);
});

test('phone menus open and close', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await hydrated(page);
	await page.getByRole('button', { name: 'Buka menu' }).click();
	await page.getByRole('dialog').getByRole('link', { name: 'FAQ' }).click();
	await expect(page).toHaveURL(/\/faq$/);

	await page.goto('/admin');
	await hydrated(page);
	await page.getByRole('button', { name: 'Buka menu' }).click();
	await page.getByRole('dialog').getByRole('link', { name: 'Klien' }).click();
	await expect(page).toHaveURL(/\/admin\/klien$/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});
