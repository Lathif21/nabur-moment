// P2-02 "Done when": clients can be added, edited, archived, searched; WhatsApp opens wa.me/628….
// Plus the limited e2e user (clients:read only) sees the list without write buttons and its
// create action is refused. Dev branch only; removes the clients it made.
import { expect, test, type Page } from '@playwright/test';
import { like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { client } from '../../src/lib/server/db/schema/index.ts';
import { STAFF_EMAIL, STAFF_PASSWORD } from './global-setup.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Klien';
const name = `${PREFIX} ${run}`;
// 0899 8xxx xxxx: outside the seed range, unique per run
const local = `08998${String(Date.now()).slice(-7)}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		await db.delete(client).where(like(client.name, `${PREFIX}%`));
	} finally {
		await db.$client.end();
	}
});

async function login(page: Page, who = owner, landing = /\/admin$/) {
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(who.email);
	await page.getByLabel('Kata sandi').fill(who.password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(landing);
}

test('add, search, edit, archive and restore a client', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page);
	await page.goto('/admin/klien');
	await page.waitForLoadState('networkidle');

	// Add
	await page.getByRole('button', { name: 'Tambah klien' }).first().click();
	const drawer = page.getByRole('dialog', { name: 'Tambah klien' });
	await drawer.getByLabel('Nama').fill(name);
	await drawer.getByLabel('WhatsApp').fill(local);
	await drawer.getByLabel('Instagram').fill(`@e2e.${run}`);
	await drawer.getByLabel('Sumber').selectOption({ label: 'Instagram' });
	await drawer.getByRole('button', { name: 'Tambah klien' }).click();
	await expect(page.getByText(`Klien ${name} ditambahkan.`)).toBeVisible();

	// Same WhatsApp again is refused on the field
	await page.getByRole('button', { name: 'Tambah klien' }).first().click();
	const again = page.getByRole('dialog', { name: 'Tambah klien' });
	await again.getByLabel('Nama').fill(`${PREFIX} dup ${run}`);
	await again.getByLabel('WhatsApp').fill(local);
	await again.getByRole('button', { name: 'Tambah klien' }).click();
	await expect(again.getByText(/sudah dipakai klien/)).toBeVisible();
	await again.getByRole('button', { name: 'Batal' }).click();

	// Search by local phone digits finds it; the WhatsApp link is wa.me/628…
	await page.getByLabel('Cari klien').fill(local.slice(0, 8));
	await page.getByRole('button', { name: 'Cari' }).click();
	await expect(page).toHaveURL(/q=/);
	const row = page.getByRole('row', { name: new RegExp(name) });
	await expect(row).toBeVisible();
	await expect(row.getByRole('link', { name: /\+62 899/ })).toHaveAttribute(
		'href',
		`https://wa.me/62${local.slice(1)}`
	);

	// Edit from the list
	await row.getByRole('button', { name: `Ubah ${name}` }).click();
	const edit = page.getByRole('dialog', { name: 'Ubah klien' });
	await edit.getByLabel('Kota').fill('Bandung');
	await edit.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Data klien disimpan.')).toBeVisible();

	// Client page: contact buttons and activity
	await page.getByRole('link', { name }).click();
	await expect(page).toHaveURL(/\/admin\/klien\/[0-9a-f-]{36}$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
	await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
		'href',
		`https://wa.me/62${local.slice(1)}`
	);
	await expect(page.getByRole('link', { name: `@e2e.${run}` })).toBeVisible();
	await expect(page.getByText('Bandung', { exact: false }).first()).toBeVisible();
	await expect(page.getByText('Klien ditambahkan')).toBeVisible();

	// Archive: gone from the active list, shown under Arsip, then restored
	await page.getByRole('button', { name: 'Arsipkan' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Arsipkan' }).click();
	await expect(page.getByText(`${name} diarsipkan.`)).toBeVisible();

	await page.goto(`/admin/klien?q=${encodeURIComponent(name)}`);
	await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(0);
	await page.goto(`/admin/klien?arsip=1&q=${encodeURIComponent(name)}`);
	await page.waitForLoadState('networkidle');
	const archived = page.getByRole('row', { name: new RegExp(name) });
	await expect(archived).toBeVisible();
	await archived.getByRole('button', { name: `Kembalikan ${name}` }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Kembalikan' }).click();
	await expect(page.getByText(`${name} dikembalikan dari arsip.`)).toBeVisible();
});

test('a read-only user sees clients but cannot change them', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await login(page, { email: STAFF_EMAIL, password: STAFF_PASSWORD }, /\/admin\/klien$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Klien');
	await expect(page.getByRole('button', { name: 'Tambah klien' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Ubah / })).toHaveCount(0);

	const res = await page.request.post('/admin/klien?/create', {
		form: { name: `${PREFIX} forbidden ${run}` },
		headers: { origin: new URL(page.url()).origin }
	});
	expect(res.status()).toBe(403);
});
