// P1-07 "Done when": an album with photos, a vertical video and an embed is published and viewable
// on a phone; an album hidden or added after the last Terbitkan is a 404 until the next Terbitkan.
// Real uploads to the dev bucket; cleans up after itself.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { gotoFresh } from './helpers/fresh.ts';
import { eq, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { media, portfolioAlbum } from '../../src/lib/server/db/schema/index.ts';
import { publishList } from '../../src/lib/server/services/cms-lists.ts';
import {
	confirmUpload,
	createEmbed,
	createUpload,
	deleteMedia,
	updateMedia
} from '../../src/lib/server/services/media.ts';
import { deleteAlbum } from '../../src/lib/server/services/portfolio.ts';
import { neonStorage, storageConfig } from '../../src/lib/server/storage/files.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const title = `Album ${run}`;
const slug = `album-${run}`;
const created: string[] = [];

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email || !storageConfig(process.env),
	'needs the dev branch, its storage and E2E_EMAIL / E2E_PASSWORD'
);
test.setTimeout(180_000);

async function put(
	uploads: { key: string; url: string; headers: Record<string, string> }[],
	body: (key: string) => Buffer
) {
	for (const u of uploads) {
		const res = await fetch(u.url, {
			method: 'PUT',
			body: new Uint8Array(body(u.key)),
			headers: u.headers
		});
		if (!res.ok) throw new Error(`upload ${u.key}: ${res.status}`);
	}
}

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	const storage = neonStorage(storageConfig(process.env)!);
	try {
		const png = readFileSync('static/icon-512.png');
		const img = await createUpload(
			db,
			storage,
			{ kind: 'image', filename: `e2e-${run}.png`, width: 512, height: 512, variants: [480, 512] },
			null
		);
		await put(img.uploads, () => png);
		await confirmUpload(db, storage, img.id);
		await updateMedia(db, img.id, { alt: `Foto ${run}` });

		const mp4 = readFileSync('static/media/hero.mp4');
		const poster = readFileSync('static/media/hero-poster.webp');
		const vid = await createUpload(
			db,
			storage,
			{ kind: 'video', filename: `e2e-${run}.mp4`, mime: 'video/mp4', width: 720, height: 1280 },
			null
		);
		await put(vid.uploads, (k) => (k.endsWith('.mp4') ? mp4 : poster));
		await confirmUpload(db, storage, vid.id);

		const emb = await createEmbed(db, { url: `https://youtu.be/e2e${run}` }, null);
		created.push(img.id, vid.id, emb.id);
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	const storage = neonStorage(storageConfig(process.env)!);
	try {
		const albums = await db
			.select({ id: portfolioAlbum.id })
			.from(portfolioAlbum)
			.where(like(portfolioAlbum.slug, `album-${run}%`));
		for (const a of albums) await deleteAlbum(db, a.id);
		await publishList(db, 'portfolio', null);
		for (const id of created) await deleteMedia(db, storage, id).catch(() => {});
		await db.delete(media).where(eq(media.filename, `e2e-${run}.png`));
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

test('album with photo, vertical video and embed: publish, view on a phone, hide', async ({
	page,
	browser
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);

	// 1. New album with the three media
	await page.goto('/admin/konten/portofolio/baru');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Judul').fill(title);
	await page.getByLabel('Jenis acara').selectOption('akad');
	await page.getByLabel('Kota').fill('Bandung');
	await page.getByRole('button', { name: 'Simpan album' }).click();
	await expect(page).toHaveURL(/\/admin\/konten\/portofolio\/[0-9a-f-]{36}$/);
	await page.waitForLoadState('networkidle');

	await page.getByRole('button', { name: 'Tambah media' }).click();
	const picker = page.getByRole('dialog', { name: 'Tambah media ke album' });
	await picker.getByRole('button', { name: `Gambar: Foto ${run}` }).click();
	await picker.getByRole('button', { name: `Video: e2e-${run}.mp4` }).click();
	await picker.getByRole('button', { name: new RegExp(`^Embed: YouTube .*e2e${run}$`) }).click();
	await picker.getByRole('button', { name: 'Pilih (3)' }).click();
	await expect(
		page.getByRole('list', { name: 'Urutan media album' }).getByRole('listitem')
	).toHaveCount(3);
	await page.getByRole('button', { name: 'Simpan album' }).click();
	await expect(page.getByText('Album disimpan.')).toBeVisible();

	// 2. Not public before Terbitkan
	const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
	expect((await phone.goto(`/portofolio/${slug}`))?.status()).toBe(404);

	await page.goto('/admin/konten/portofolio');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Terbitkan' }).click();
	await expect(page.getByText('Portofolio diterbitkan.')).toBeVisible();

	// 3. Viewable on a phone: photo, video, click-to-load embed
	await gotoFresh(phone, `/portofolio/${slug}`, async (res) => expect(res?.status()).toBe(200));
	await phone.waitForLoadState('networkidle');
	await expect(phone.getByRole('heading', { level: 1 })).toHaveText(title);
	await expect(phone.getByRole('button', { name: `Perbesar foto: Foto ${run}` })).toBeVisible();
	await expect(phone.locator('video')).toHaveCount(1);
	await expect(phone.locator('iframe')).toHaveCount(0);
	await phone.getByRole('button', { name: 'Putar dari YouTube' }).click();
	await expect(phone.locator('iframe')).toHaveAttribute(
		'src',
		`https://www.youtube-nocookie.com/embed/e2e${run}`
	);
	await phone.getByRole('button', { name: `Perbesar foto: Foto ${run}` }).click();
	await expect(phone.getByRole('dialog')).toBeVisible();
	await phone.keyboard.press('Escape');
	await gotoFresh(phone, '/portofolio', () =>
		expect(phone.getByRole('link', { name: new RegExp(title) })).toBeVisible({ timeout: 3_000 })
	);

	// 4. Hidden → still public until Terbitkan, then 404
	await page.getByRole('button', { name: `Sembunyikan album ${title}` }).click();
	await expect(page.getByText('Album disembunyikan.')).toBeVisible();
	expect((await phone.goto(`/portofolio/${slug}`))?.status()).toBe(200);
	// Wait for the list status itself; the first publish toast may still be on screen
	await expect(page.getByText('Belum diterbitkan')).toBeVisible();
	await page.getByRole('button', { name: 'Terbitkan' }).click();
	await expect(page.getByText('Belum diterbitkan')).toHaveCount(0);
	await gotoFresh(phone, `/portofolio/${slug}`, async (res) => expect(res?.status()).toBe(404));
	await phone.close();
});
