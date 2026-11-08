// P4-02 accessibility pass: axe (WCAG 2.2 A/AA) on the public pages at phone width and the main
// admin screens at desktop width; every published site image has alt text. Fails on serious and
// critical violations only. Read-only: changes no data.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };

// axe on every page in one test takes a while
test.describe.configure({ timeout: 300_000 });

const PUBLIC = ['/', '/tentang', '/paket', '/faq', '/portofolio', '/booking'];
const ADMIN = [
	'/admin',
	'/admin/booking',
	'/admin/booking/daftar',
	'/admin/klien',
	'/admin/kalender',
	'/admin/keuangan/invoice',
	'/admin/keuangan/pembayaran',
	'/admin/keuangan/pengeluaran',
	'/admin/keuangan/laba-rugi',
	'/admin/konten/halaman',
	'/admin/konten/media',
	'/admin/konten/portofolio',
	'/admin/konten/paket',
	'/admin/pengaturan/situs',
	'/admin/pengaturan/bisnis',
	'/admin/akses/pengguna'
];

async function audit(page: Page) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	return violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** Images a visitor can perceive must describe themselves; decorative ones are hidden from AT */
async function imagesWithoutAlt(page: Page) {
	return page.locator('img').evaluateAll((imgs) =>
		imgs
			.filter(
				(img) => !img.closest('[aria-hidden="true"]') && img.getAttribute('role') !== 'presentation'
			)
			.filter((img) => !(img.getAttribute('alt') ?? '').trim())
			.map((img) => (img as HTMLImageElement).currentSrc || img.getAttribute('src') || '?')
	);
}

test('public pages: no serious axe violations; every image has alt text', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const pages = [...PUBLIC];
	// One album page too, when the dev branch has a published album
	await page.goto('/portofolio');
	await page.waitForLoadState('networkidle');
	const albums = page.locator('a[href*="/portofolio/"]');
	if (await albums.count()) {
		const album = await albums.first().getAttribute('href');
		if (album) pages.push(new URL(album, page.url()).pathname);
	}

	const problems: string[] = [];
	for (const path of pages) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		for (const v of await audit(page)) problems.push(`${path} ${v}`);
		for (const src of await imagesWithoutAlt(page))
			problems.push(`${path} img without alt: ${src}`);
	}
	expect(problems, problems.join('\n')).toEqual([]);
});

test('admin screens: no serious axe violations', async ({ page }) => {
	test.skip(
		!owner.email || process.env.NEON_BRANCH !== 'dev',
		'needs the dev branch and E2E_EMAIL'
	);
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	for (const v of await audit(page)) expect.soft(v, '/admin/login').toBe('');
	await page.getByLabel('Email').fill(owner.email);
	await page.getByLabel('Kata sandi').fill(owner.password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(/\/admin$/);

	const problems: string[] = [];
	for (const path of ADMIN) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		for (const v of await audit(page)) problems.push(`${path} ${v}`);
	}
	expect(problems, problems.join('\n')).toEqual([]);
});
