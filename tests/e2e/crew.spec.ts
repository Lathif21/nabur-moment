// Crew (client feedback 11 Nov 2026): add crew on Kru, pick 1–2 on a booking, see them on the
// board card and as the chip colour on the Kalender. Dev branch only; removes what it made.
import { expect, test, type Page } from '@playwright/test';
import { inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, crew } from '../../src/lib/server/db/schema/index.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E Crew';
const names = ['Andi', 'Budi', 'Citra'].map((n) => `${PREFIX} ${n} ${run}`);
const title = `${PREFIX} Wedding ${run}`;
// A far-future day no seed booking uses
const MONTH = `2033-0${1 + (Date.now() % 9)}`;
const DAY = `${MONTH}-1${Date.now() % 10}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const ids = (
			await db
				.select({ id: client.id })
				.from(client)
				.where(like(client.name, `${PREFIX}%`))
		).map((c) => c.id);
		if (ids.length) {
			await db.delete(booking).where(inArray(booking.clientId, ids));
			await db.delete(client).where(inArray(client.id, ids));
		}
		await db.delete(crew).where(like(crew.name, `${PREFIX}%`));
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

test('add crew, assign two to a booking, see them on the card and the calendar', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);

	// 1. Kru: add three, from the sidebar
	await page.getByRole('link', { name: 'Kru', exact: true }).first().click();
	await expect(page).toHaveURL(/\/admin\/kru/);
	await page.waitForLoadState('networkidle');
	for (const [i, name] of names.entries()) {
		await page.getByRole('button', { name: 'Tambah kru' }).first().click();
		const modal = page.getByRole('dialog', { name: 'Tambah kru' });
		await modal.getByLabel('Nama').fill(name);
		await modal.getByLabel('Peran').fill(i === 2 ? 'Videografer' : 'Fotografer');
		if (i === 0) await modal.getByLabel('WhatsApp').fill('0812-0000-1111');
		await modal.getByRole('button', { name: 'Simpan' }).click();
		await expect(page.getByText('Kru ditambahkan.').first()).toBeVisible();
		await expect(page.getByRole('link', { name })).toBeVisible();
	}

	// 2. New booking with two crew: the third box is then disabled
	await page.goto('/admin/booking');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Booking baru' }).click();
	const drawer = page.getByRole('dialog', { name: 'Booking baru' });
	await drawer.getByRole('button', { name: 'Klien baru' }).click();
	await drawer.getByLabel('Nama klien').fill(`${PREFIX} Klien ${run}`);
	await drawer.getByLabel('Judul').fill(title);
	await drawer.getByLabel('Tanggal').fill(DAY);
	const crewBox = drawer.getByRole('group', { name: 'Kru' });
	await crewBox.getByLabel(new RegExp(names[0])).check();
	await crewBox.getByLabel(new RegExp(names[1])).check();
	await expect(crewBox.getByLabel(new RegExp(names[2]))).toBeDisabled();
	await expect(crewBox.getByText('Dipilih 2.')).toBeVisible();
	await drawer.getByRole('button', { name: 'Buat booking' }).click();
	await expect(page.getByText(`Booking ${title} dibuat.`)).toBeVisible();

	// 3. The card shows the count and the names
	const card = page.locator('article.kcard', { has: page.getByRole('heading', { name: title }) });
	await expect(card).toContainText(`2 kru · ${names[0]}, ${names[1]}`);

	// 4. Kalender: a tentative (no DP) chip outlined in the 2-crew colour
	await page.goto(`/admin/kalender?bulan=${MONTH}`);
	await page.waitForLoadState('networkidle');
	const chip = page
		.getByRole('button', { name: new RegExp(`${title}.*2 kru`) })
		.filter({ visible: true })
		.first();
	await expect(chip).toHaveAttribute('data-crew', '2');
	await expect(chip).toHaveAttribute('data-status', 'tentative');
	await expect(chip).toHaveClass(/border-crew-2/);
	await expect(page.getByRole('list', { name: 'Keterangan' })).toContainText('2 kru');
	await chip.click();
	await expect(page.getByRole('dialog', { name: title })).toContainText(`${names[0]}, ${names[1]}`);

	// 5. Not counted yet on Kru (no DP): the detail page says so
	await page.goto(`/admin/kru?period=month&from=${DAY}`);
	await page.waitForLoadState('networkidle');
	const row = page.getByRole('row', { name: new RegExp(names[0]) });
	await expect(row.getByRole('cell').nth(2)).toHaveText('0');
	await row.getByRole('link', { name: names[0] }).click();
	await expect(page.getByRole('heading', { name: names[0], level: 1 })).toBeVisible();
	await expect(page.getByText('Tidak ada booking (Booked ke atas)')).toBeVisible();
});
