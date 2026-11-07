// P1-02 "Done when": images, an MP4 and an embed can be added, edited and deleted; the picker
// returns ids. Real uploads to the `dev` bucket; cleans up after itself.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { like, or } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { media } from '../../src/lib/server/db/schema/index.ts';
import { deleteMedia } from '../../src/lib/server/services/media.ts';
import { neonStorage, storageConfig } from '../../src/lib/server/storage/files.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const imageName = `e2e-${run}.png`;
const videoName = `e2e-${run}.mp4`;
const embedUrl = `https://youtu.be/e2e${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email || !storageConfig(process.env),
	'needs the dev branch, its storage and E2E_EMAIL / E2E_PASSWORD'
);
test.setTimeout(180_000);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	const storage = neonStorage(storageConfig(process.env)!);
	try {
		const left = await db
			.select({ id: media.id })
			.from(media)
			.where(or(like(media.filename, `e2e-${run}%`), like(media.embedUrl, `%e2e${run}`)));
		for (const m of left) await deleteMedia(db, storage, m.id).catch(() => {});
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

const tile = (page: Page, name: string | RegExp) =>
	page.getByRole('list', { name: 'Media' }).getByRole('button', { name });

async function remove(page: Page, name: string | RegExp) {
	await tile(page, name).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Hapus' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus' }).click();
	await expect(page.getByText('Media dihapus.').first()).toBeVisible();
	await expect(tile(page, name)).toHaveCount(0);
}

test('upload, edit, pick and delete images, an MP4 and an embed', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	await page.goto('/admin/konten/media');
	await page.waitForLoadState('networkidle');

	// 1. Upload an image and an MP4 (resized / poster captured in the browser)
	await page.getByLabel('Pilih file untuk diunggah').setInputFiles([
		{ name: imageName, mimeType: 'image/png', buffer: readFileSync('static/icon-512.png') },
		{ name: videoName, mimeType: 'video/mp4', buffer: readFileSync('static/media/hero.mp4') }
	]);
	const uploads = page.getByRole('list', { name: 'Unggahan' });
	await expect(uploads.getByLabel('Selesai')).toHaveCount(2, { timeout: 120_000 });
	await expect(tile(page, `Gambar: ${imageName}`)).toBeVisible();
	await expect(tile(page, `Video: ${videoName}`)).toBeVisible();

	// 2. Embed
	await page.getByRole('button', { name: 'Tambah embed' }).click();
	await page.getByLabel('Tautan').fill(embedUrl);
	await page.getByRole('dialog').getByRole('button', { name: 'Tambah' }).click();
	await expect(page.getByText('Embed ditambahkan.')).toBeVisible();
	const embedTile = tile(page, new RegExp(`^Embed: YouTube .*e2e${run}$`));
	await expect(embedTile).toBeVisible();

	// 3. Edit the image: alt + focal point (keyboard)
	await tile(page, `Gambar: ${imageName}`).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByLabel('Teks alternatif (alt)').fill(`Ikon ${run}`);
	await drawer.getByRole('button', { name: /Titik fokus/ }).press('ArrowRight');
	await expect(drawer.getByText('Fokus 55% · 50%')).toBeVisible();
	await drawer.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Media disimpan.')).toBeVisible();
	await drawer.getByRole('button', { name: 'Tutup' }).first().click();
	await expect(tile(page, `Gambar: Ikon ${run}`)).toBeVisible();

	// 4. The picker returns ids
	await page.goto('/admin/dev/komponen');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Pilih media' }).click();
	const picker = page.getByRole('dialog', { name: 'Pilih media' });
	await picker.getByRole('button', { name: `Gambar: Ikon ${run}` }).click();
	await picker.getByRole('button', { name: `Video: ${videoName}` }).click();
	await picker.getByRole('button', { name: 'Pilih (2)' }).click();
	await expect(page.getByTestId('picked-ids')).toHaveText(/^[0-9a-f-]{36},[0-9a-f-]{36}$/);

	// 5. Delete all three (row and files)
	await page.goto('/admin/konten/media');
	await page.waitForLoadState('networkidle');
	await remove(page, `Gambar: Ikon ${run}`);
	await remove(page, `Video: ${videoName}`);
	await remove(page, new RegExp(`^Embed: YouTube .*e2e${run}$`));
});
