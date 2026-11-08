// P1-03 "Done when": editing a field and pressing Terbitkan changes what the public route reads;
// preview shows drafts only to logged-in users. Dev branch only; restores the original content.
import { expect, test, type Page } from '@playwright/test';
import { getSection } from '../../src/lib/cms/sections.ts';
import { createDb } from '../../src/lib/server/db/client.ts';
import {
	getPageForEdit,
	publishPage,
	saveSectionDraft
} from '../../src/lib/server/services/cms-pages.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const headline = `Uji ${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let original: Record<string, unknown> | null = null;

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		original = (await getPageForEdit(db, 'home')).find((s) => s.key === 'hero')!.draft;
		// Two suites running at once on the shared dev branch can save another run's test headline
		// as the "original" and restore it for good; never keep a leftover, use the default.
		if (/^Uji [a-z0-9]+$/.test(String(original.headline)))
			original = { ...original, headline: getSection('home', 'hero')!.defaults.headline };
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	if (!original) return;
	const db = createDb(process.env.DATABASE_URL!);
	try {
		await saveSectionDraft(db, 'home', 'hero', { data: original, visible: true }, null);
		await publishPage(db, 'home', null);
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

test('edit → draft is private → preview for admins → Terbitkan → public', async ({
	page,
	browser
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);

	// Pages list → editor
	await page.goto('/admin/konten/halaman');
	await page
		.getByRole('row', { name: /Beranda/ })
		.getByRole('link', { name: 'Ubah' })
		.click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Beranda');
	await page.waitForLoadState('networkidle');

	const hero = page.getByRole('region', { name: /Hero/ });
	await hero.getByLabel('Judul', { exact: true }).fill(headline);
	await expect(hero.getByText('Tersimpan')).toBeVisible();
	await expect(hero.getByText('Belum diterbitkan')).toBeVisible();

	// A visitor (no session) still sees the published hero, even with ?preview=1
	const visitor = await browser.newPage();
	await visitor.goto('/?preview=1');
	await expect(visitor.getByRole('heading', { level: 1 })).not.toContainText(headline);
	await expect(visitor.getByRole('status').filter({ hasText: 'Pratinjau' })).toHaveCount(0);

	// The admin's preview shows the draft
	const preview = await page.context().newPage();
	await preview.goto('/?preview=1');
	await expect(preview.getByRole('heading', { level: 1 })).toContainText(headline);
	await expect(preview.getByText('Pratinjau draf')).toBeVisible();

	// Terbitkan → everyone sees it
	await page.getByRole('button', { name: 'Terbitkan' }).click();
	await expect(page.getByText('Halaman diterbitkan.')).toBeVisible();
	await expect(
		page.getByRole('region', { name: /Hero/ }).getByText('Belum diterbitkan')
	).toHaveCount(0);
	await visitor.goto('/');
	await expect(visitor.getByRole('heading', { level: 1 })).toContainText(headline);
	await visitor.close();
});
