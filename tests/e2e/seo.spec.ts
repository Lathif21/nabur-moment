// P1-09 "Done when": the sitemap lists every published album; the share preview shows the CMS
// image. Also robots.txt and the admin noindex header. Dev branch only; restores what it changes.
import { expect, test } from '@playwright/test';
import { gotoFresh, revalidateRemote } from './helpers/fresh.ts';
import { eq } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { media } from '../../src/lib/server/db/schema/index.ts';
import {
	publishPage,
	getPageForEdit,
	saveSectionDraft
} from '../../src/lib/server/services/cms-pages.ts';
import { publishList } from '../../src/lib/server/services/cms-lists.ts';
import { deleteAlbum, saveAlbum } from '../../src/lib/server/services/portfolio.ts';
import { neonStorage, storageConfig } from '../../src/lib/server/storage/files.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const run = Date.now().toString(36);
const slug = `seo-${run}`;
const key = `media/seo-${run}/w1200.webp`;
let albumId = '';
let mediaId = '';
let seoBefore: Record<string, unknown> | null = null;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !storageConfig(process.env),
	'needs the dev branch and its storage'
);

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		// A share image row (the file itself is not needed for the meta tag)
		const [m] = await db
			.insert(media)
			.values({
				kind: 'image',
				bucket: 'site-media',
				key,
				variants: [{ w: 1200, key }],
				width: 1200,
				height: 630,
				alt: `Bagikan ${run}`,
				filename: `seo-${run}.webp`,
				status: 'ready'
			})
			.returning();
		mediaId = m.id;
		const album = await saveAlbum(db, null, {
			title: `SEO ${run}`,
			slug,
			eventType: 'wedding',
			eventDate: null,
			venue: '',
			city: '',
			story: 'Album untuk tes SEO.',
			coverMediaId: null,
			featured: false,
			visible: true,
			items: []
		});
		albumId = album.id;
		await publishList(db, 'portfolio', null);

		seoBefore = (await getPageForEdit(db, 'home')).find((s) => s.key === 'seo')!.draft;
		await saveSectionDraft(
			db,
			'home',
			'seo',
			{ data: { title: '', description: `Deskripsi ${run}`, image: mediaId }, visible: true },
			null
		);
		await publishPage(db, 'home', null);
	} finally {
		await db.$client.end();
	}
	await revalidateRemote(['', `portofolio/${slug}`, 'portofolio', 'sitemap.xml']);
});

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		if (seoBefore) {
			await saveSectionDraft(db, 'home', 'seo', { data: seoBefore, visible: true }, null);
			await publishPage(db, 'home', null);
		}
		if (albumId) await deleteAlbum(db, albumId);
		await publishList(db, 'portfolio', null);
		if (mediaId) await db.delete(media).where(eq(media.id, mediaId));
	} finally {
		await db.$client.end();
	}
	await revalidateRemote(['', `portofolio/${slug}`, 'portofolio', 'sitemap.xml']);
});

test('sitemap lists published albums; robots.txt and admin noindex', async ({ request }) => {
	// Cached on Vercel: the refreshed sitemap reaches every edge within a few seconds
	let xml = '';
	await expect(async () => {
		const sitemap = await request.get('/sitemap.xml');
		expect(sitemap.headers()['content-type']).toContain('application/xml');
		xml = await sitemap.text();
		expect(xml).toContain(`/portofolio/${slug}</loc>`);
	}).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });
	expect(xml).toContain('/paket</loc>');

	const robots = await (await request.get('/robots.txt')).text();
	expect(robots).toContain('Disallow: /admin');
	expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);

	const admin = await request.get('/admin/login');
	expect(admin.headers()['x-robots-tag']).toContain('noindex');
});

test('share preview uses the CMS image and description', async ({ page }) => {
	const storage = neonStorage(storageConfig(process.env)!);
	await gotoFresh(page, '/', () =>
		expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
			'content',
			storage.publicUrl(key),
			{ timeout: 3_000 }
		)
	);
	await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
		'content',
		`Deskripsi ${run}`
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/$/);

	// Album pages describe themselves
	await gotoFresh(page, `/portofolio/${slug}`, async (res) => expect(res?.status()).toBe(200));
	await expect(page).toHaveTitle(new RegExp(`^SEO ${run} · `));
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		'content',
		'Album untuk tes SEO.'
	);
});
