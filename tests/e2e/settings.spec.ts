// P1-04 "Done when": header / footer / meta tags on the public layout come from published
// settings. Dev branch only; restores the original settings.
import { expect, test, type Page } from '@playwright/test';
import { createDb } from '../../src/lib/server/db/client.ts';
import {
	getSiteSettingsForEdit,
	publishSiteSettings,
	saveSiteSettingsDraft
} from '../../src/lib/server/services/site-settings.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let original: Record<string, unknown> | null = null;

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		original = (await getSiteSettingsForEdit(db)).draft;
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	if (!original) return;
	const db = createDb(process.env.DATABASE_URL!);
	try {
		await saveSiteSettingsDraft(db, original, null);
		await publishSiteSettings(db, null);
	} finally {
		await db.$client.end();
	}
});

async function login(page: Page) {
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(owner.email);
	await page.getByLabel('Kata sandi').fill(owner.password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(/\/admin$/);
}

test('published settings drive the footer and meta tags', async ({ page, browser }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	await page.goto('/admin/pengaturan/situs');
	await page.waitForLoadState('networkidle');

	await page.getByLabel('Kalimat di footer').fill(`Footer ${run}`);
	await page.getByLabel('Nomor WhatsApp').fill('0812-3456-7890');
	await page.getByLabel('Deskripsi situs (SEO)').fill(`Deskripsi ${run}`);
	await expect(page.getByText('Tersimpan')).toBeVisible();

	// Not public before Terbitkan
	const visitor = await browser.newPage();
	await visitor.goto('/');
	await expect(visitor.getByRole('contentinfo')).not.toContainText(`Footer ${run}`);

	await page.getByRole('button', { name: 'Terbitkan' }).click();
	await expect(page.getByText('Pengaturan situs diterbitkan.')).toBeVisible();

	await visitor.goto('/');
	const footer = visitor.getByRole('contentinfo');
	await expect(footer).toContainText(`Footer ${run}`);
	await expect(footer.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
		'href',
		'https://wa.me/6281234567890'
	);
	await expect(visitor.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		`Deskripsi ${run}`
	);
	await visitor.close();
});
