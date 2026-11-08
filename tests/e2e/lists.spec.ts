// P1-05 "Done when": items can be created, reordered, hidden; nothing changes on the site until
// Terbitkan; after it, hidden items are gone and order matches. Dev branch only; cleans up.
import { expect, test, type Page } from '@playwright/test';
import { gotoFresh } from './helpers/fresh.ts';
import { like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { faqItem } from '../../src/lib/server/db/schema/index.ts';
import { publishList } from '../../src/lib/server/services/cms-lists.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const q = (letter: string) => `Pertanyaan ${letter} ${run}?`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		await db.delete(faqItem).where(like(faqItem.question, `% ${run}?`));
		await publishList(db, 'faq', null);
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

async function addFaq(page: Page, question: string) {
	await page.getByRole('button', { name: 'Pertanyaan', exact: true }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByLabel('Pertanyaan').fill(question);
	await drawer.getByLabel('Jawaban').fill(`Jawaban untuk ${question}`);
	await drawer.getByRole('button', { name: 'Simpan' }).click();
	await expect(
		page.getByRole('list', { name: 'Urutan FAQ' }).getByText(question, { exact: true })
	).toBeVisible();
}

const mine = (page: Page) =>
	page
		.getByRole('list', { name: 'Urutan FAQ' })
		.getByRole('listitem')
		.filter({ hasText: run })
		.locator('p.font-semibold');

test('FAQ: create, reorder, hide, then Terbitkan', async ({ page, browser }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	await page.goto('/admin/konten/faq');
	await page.waitForLoadState('networkidle');

	for (const l of ['A', 'B', 'C']) await addFaq(page, q(l));
	await expect(mine(page)).toHaveText([q('A'), q('B'), q('C')]);

	// Keyboard reorder: C to the top
	await page.getByRole('button', { name: `Naikkan ${q('C')}` }).click();
	await expect(mine(page)).toHaveText([q('A'), q('C'), q('B')]);
	await page.getByRole('button', { name: `Naikkan ${q('C')}` }).click();
	await expect(mine(page)).toHaveText([q('C'), q('A'), q('B')]);

	// Hide A
	await page.getByRole('button', { name: `Sembunyikan ${q('A')}` }).click();
	await expect(page.getByText('Pertanyaan disembunyikan.')).toBeVisible();
	await expect(page.getByText('Belum diterbitkan')).toBeVisible();

	// Nothing on the site yet
	const visitor = await browser.newPage();
	await visitor.goto('/faq');
	await expect(visitor.getByText(run)).toHaveCount(0);

	await page.getByRole('button', { name: 'Terbitkan' }).click();
	await expect(page.getByText('FAQ diterbitkan.')).toBeVisible();

	// FAQ accordion: one trigger button per published question, in order
	await gotoFresh(visitor, '/faq', () =>
		expect(visitor.getByRole('button').filter({ hasText: run })).toHaveText([q('C'), q('B')], {
			timeout: 3_000
		})
	);
	await visitor.close();
});
