import { expect, test, type Page } from '@playwright/test';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const email = process.env.E2E_EMAIL ?? '';
const password = process.env.E2E_PASSWORD ?? '';

/** Buttons only work after hydration; on a cold dev server that can take a moment */
async function hydrated(page: Page) {
	await page.waitForLoadState('networkidle');
}

async function login(page: Page) {
	test.skip(!email || !password, 'E2E_EMAIL / E2E_PASSWORD not set');
	await page.goto('/admin/login');
	await hydrated(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Kata sandi').fill(password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(/\/admin$/);
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

test('admin redirects to login when logged out; wrong password is refused', async ({ page }) => {
	await page.goto('/admin/keuangan/invoice');
	await expect(page).toHaveURL(/\/admin\/login$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Masuk');
	await expect(page.getByRole('link', { name: /daftar/i })).toHaveCount(0);

	await hydrated(page);
	await page.getByLabel('Email').fill(email || 'siapa@naburmoment.test');
	await page.getByLabel('Kata sandi').fill('bukan-sandinya');
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
});

test('sign-up endpoint is closed', async ({ request }) => {
	const res = await request.post('/api/auth/sign-up/email', {
		data: { email: 'penyusup@naburmoment.test', password: 'rahasia-123', name: 'Penyusup' }
	});
	expect(res.ok()).toBe(false);
});

test('owner logs in, uses the sidebar, logs out', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
	await page
		.getByRole('navigation', { name: 'Menu admin' })
		.getByRole('link', { name: 'Kalender' })
		.click();
	await expect(page).toHaveURL(/\/admin\/kalender$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kalender');
	const res = await page.goto('/admin/tidak-ada');
	expect(res?.status()).toBe(404);

	await page.goto('/admin');
	await hydrated(page);
	await page.getByRole('button', { name: 'Keluar' }).click();
	await expect(page).toHaveURL(/\/admin\/login$/);
	await page.goto('/admin');
	await expect(page).toHaveURL(/\/admin\/login$/);
});

test('phone menus open and close', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await hydrated(page);
	await page.getByRole('button', { name: 'Buka menu' }).click();
	await page.getByRole('dialog').getByRole('link', { name: 'FAQ' }).click();
	await expect(page).toHaveURL(/\/faq$/);

	await login(page);
	await hydrated(page);
	await page.getByRole('button', { name: 'Buka menu' }).click();
	await page.getByRole('dialog').getByRole('link', { name: 'Klien' }).click();
	await expect(page).toHaveURL(/\/admin\/klien$/);
	await expect(page.getByRole('dialog')).toHaveCount(0);
});
