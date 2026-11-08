// P3-05 "Done when": booking profit = its payments − its expenses; overhead rows have no booking.
// From the UI: "Tambah biaya" on the booking page (with a receipt photo) changes Biaya and Laba;
// an overhead expense from Pengeluaran shows under Overhead only. Dev branch only; cleans up.
import { expect, test, type Page } from '@playwright/test';
import { inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, expense, media, payment } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { paymentSchema } from '../../src/lib/schemas/finance.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';
import { listSchedule } from '../../src/lib/server/services/installments.ts';
import { recordPayment } from '../../src/lib/server/services/payments.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Exp';
const TITLE = `${PREFIX} ${run}`;
const OVERHEAD = `${PREFIX} iklan ${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let bookingId = '';

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const made = await createBooking(
			db,
			bookingSchema.parse({
				newClientName: `${PREFIX} ${run}`,
				newClientPhone: `08993${String(Date.now()).slice(-7)}`,
				title: TITLE,
				eventType: 'wedding',
				agreedPrice: '10000000',
				sessions: JSON.stringify([{ eventType: 'akad', date: '2034-11-11' }]),
				addons: '[]'
			}),
			null
		);
		bookingId = made.id;
		const [dp] = await listSchedule(db, made.id);
		await recordPayment(
			db,
			paymentSchema.parse({
				bookingId: made.id,
				target: `inst:${dp.id}`,
				paidOn: '2034-10-01',
				amount: '5000000',
				method: 'transfer'
			}),
			null
		);
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const rows = await db
			.select({ id: expense.id, receipt: expense.receiptMediaId })
			.from(expense)
			.where(like(expense.description, `${PREFIX}%`));
		if (rows.length) {
			await db.delete(expense).where(
				inArray(
					expense.id,
					rows.map((r) => r.id)
				)
			);
			const receipts = rows.map((r) => r.receipt).filter((id): id is string => !!id);
			if (receipts.length) await db.delete(media).where(inArray(media.id, receipts));
		}
		const clients = (
			await db
				.select({ id: client.id })
				.from(client)
				.where(like(client.name, `${PREFIX}%`))
		).map((c) => c.id);
		if (clients.length) {
			const bookings = (
				await db.select({ id: booking.id }).from(booking).where(inArray(booking.clientId, clients))
			).map((b) => b.id);
			if (bookings.length) {
				await db.delete(payment).where(inArray(payment.bookingId, bookings));
				await db.delete(booking).where(inArray(booking.id, bookings));
			}
			await db.delete(client).where(inArray(client.id, clients));
		}
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

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

test('booking cost changes Biaya and Laba; overhead stays out of Per booking', async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await login(page);

	await page.goto(`/admin/booking/${bookingId}`);
	await page.waitForLoadState('networkidle');
	const summary = page.getByRole('region', { name: 'Ringkasan' });
	await page.getByRole('button', { name: 'Tambah biaya' }).click();
	const drawer = page.getByRole('dialog', { name: 'Catat pengeluaran' });
	await drawer.getByLabel('Jumlah').fill('1500000');
	await drawer.getByLabel('Kategori').selectOption({ label: 'Fee crew' });
	await drawer.getByLabel('Keterangan').fill(`${PREFIX} second shooter ${run}`);
	await drawer
		.getByLabel('Foto nota (opsional)')
		.setInputFiles({ name: 'nota.png', mimeType: 'image/png', buffer: PNG });
	await expect(drawer.getByText('Terunggah: nota.png')).toBeVisible({ timeout: 30_000 });
	await drawer.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Pengeluaran dicatat.')).toBeVisible();

	const costs = page.getByRole('table', { name: 'Biaya booking' });
	await expect(costs).toContainText(/1\.500\.000/);
	// Laba = 5.000.000 paid − 1.500.000 costs
	await expect(summary.locator('div', { hasText: /^Laba/ })).toContainText(/3\.500\.000/);

	// The receipt opens through the permission-checked route
	const href = await costs.getByRole('link', { name: /Lihat nota/ }).getAttribute('href');
	const file = await page.request.get(href!, { maxRedirects: 0 });
	expect(file.status()).toBe(303);

	// Overhead from the Pengeluaran page
	await page.goto('/admin/keuangan/pengeluaran');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Catat pengeluaran' }).click();
	const d2 = page.getByRole('dialog', { name: 'Catat pengeluaran' });
	await d2.getByLabel('Jumlah').fill('300000');
	await d2.getByLabel('Tanggal').fill('2034-10-05');
	await d2.getByLabel('Kategori').selectOption({ label: 'Iklan' });
	await expect(d2.getByLabel('Booking')).toHaveValue('');
	await d2.getByLabel('Keterangan').fill(OVERHEAD);
	await d2.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Pengeluaran dicatat.')).toBeVisible();

	await page.goto(`/admin/keuangan/pengeluaran?q=${encodeURIComponent(run)}&jenis=overhead`);
	const rows = page.getByRole('table', { name: 'Daftar pengeluaran' }).locator('tbody tr');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toHaveAttribute('data-scope', 'overhead');
	await expect(rows.first()).toContainText('Overhead');

	await page.goto(`/admin/keuangan/pengeluaran?q=${encodeURIComponent(run)}&jenis=booking`);
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toHaveAttribute('data-scope', 'booking');
	await expect(rows.first()).toContainText(TITLE);
});
