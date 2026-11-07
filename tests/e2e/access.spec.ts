// P0-06 "Done when": the owner creates "Admin Keuangan" with Keuangan C/R/U only, assigns it, and
// that user sees only those menus. Runs on the Neon `dev` branch only; cleans up after itself.
import { expect, test, type Page } from '@playwright/test';
import { eq, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { role, user } from '../../src/lib/server/db/schema/index.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const roleName = `Admin Keuangan ${run}`;
const staffEmail = `keuangan-${run}@naburmoment.test`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		await db.delete(user).where(like(user.email, `keuangan-${run}@%`));
		await db.delete(role).where(eq(role.name, roleName));
	} finally {
		await db.$client.end();
	}
});

async function login(page: Page, as: { email: string; password: string }, landing: RegExp) {
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(as.email);
	await page.getByLabel('Kata sandi').fill(as.password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(landing);
}

test('owner sets up Admin Keuangan; that user sees only Keuangan and cannot delete', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page, owner, /\/admin$/);

	// 1. New role → editor
	await page.goto('/admin/akses/peran');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Peran baru' }).first().click();
	await page.getByLabel('Nama peran').fill(roleName);
	await page.getByRole('button', { name: 'Buat peran' }).click();
	await expect(page).toHaveURL(/\/admin\/akses\/peran\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(roleName);
	await page.waitForLoadState('networkidle');

	// 2. Keuangan C/R/U: Tambah / Ubah tick Lihat on their own; Laba Rugi is read-only
	for (const m of ['Invoice', 'Pembayaran', 'Pengeluaran']) {
		await page.getByLabel(`Tambah ${m}`).check();
		await page.getByLabel(`Ubah ${m}`).check();
		await expect(page.getByLabel(`Lihat ${m}`)).toBeChecked();
		await expect(page.getByLabel(`Hapus ${m}`)).not.toBeChecked();
	}
	await page.getByLabel('Lihat Laba Rugi').check();
	await expect(page.getByLabel('Ubah Laba Rugi')).toHaveCount(0);
	await page.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText(`Peran ${roleName} disimpan.`)).toBeVisible();

	// Saved state survives a reload
	await page.reload();
	await expect(page.getByLabel('Ubah Invoice')).toBeChecked();
	await expect(page.getByLabel('Hapus Invoice')).not.toBeChecked();
	await expect(page.getByLabel('Lihat Klien')).not.toBeChecked();

	// 3. New user with that role; the generated password is shown once
	await page.goto('/admin/akses/pengguna');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Tambah pengguna' }).click();
	const drawer = page.getByRole('dialog');
	await drawer.getByLabel('Nama').fill('Staf Keuangan');
	await drawer.getByLabel('Email').fill(staffEmail);
	await drawer.getByLabel(roleName).check();
	await drawer.getByRole('button', { name: 'Tambah pengguna' }).click();
	const password = (await page.getByTestId('new-password').textContent())!.trim();
	expect(password.length).toBeGreaterThanOrEqual(8);
	await page.getByRole('button', { name: 'Sudah disimpan' }).click();
	const row = page.getByRole('row').filter({ hasText: staffEmail });
	await expect(row.getByText(roleName)).toBeVisible();

	// 4. Log out, log in as the new user: no Dashboard, so they land on Invoice
	await page.getByRole('button', { name: 'Keluar' }).click();
	await expect(page).toHaveURL(/\/admin\/login$/);
	await login(page, { email: staffEmail, password }, /\/admin\/keuangan\/invoice$/);
	const nav = page.getByRole('navigation', { name: 'Menu admin' });
	await expect(nav.getByRole('link')).toHaveText([
		'Invoice',
		'Pembayaran',
		'Pengeluaran',
		'Laba Rugi'
	]);

	for (const path of ['/admin', '/admin/klien', '/admin/akses/peran']) {
		const res = await page.goto(path);
		if (path === '/admin') {
			await expect(page).toHaveURL(/\/admin\/keuangan\/invoice$/);
			continue;
		}
		expect(res?.status(), path).toBe(403);
	}

	// No delete anywhere: e.g. the owner-only role delete action is refused
	const res = await page.request.post('/admin/akses/peran?/delete', {
		form: { id: '00000000-0000-0000-0000-000000000000' },
		headers: { origin: new URL(page.url()).origin }
	});
	expect(res.status()).toBe(403);
});
