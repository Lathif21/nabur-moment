// P3-04 "Done when": paying the DP makes the booking bookable and the calendar shows it solid;
// partial / paid statuses are correct. Also: the board's "Catat pembayaran DP" link opens the form
// for that booking, a proof image goes to the private bucket and opens through the admin route.
// Dev branch only; removes what it made.
import { expect, test, type Page } from '@playwright/test';
import { inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, invoice, media, payment } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Pay';
const TITLE = `${PREFIX} ${run}`;
const MONTH = '2034-08';
const DAY = '2034-08-18';

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
				newClientPhone: `08995${String(Date.now()).slice(-7)}`,
				title: TITLE,
				eventType: 'wedding',
				stage: 'quotation',
				agreedPrice: '10000000',
				sessions: JSON.stringify([{ eventType: 'akad', date: DAY }]),
				addons: '[]'
			}),
			null
		);
		bookingId = made.id;
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const clients = (
			await db
				.select({ id: client.id })
				.from(client)
				.where(like(client.name, `${PREFIX}%`))
		).map((c) => c.id);
		if (!clients.length) return;
		const bookings = (
			await db.select({ id: booking.id }).from(booking).where(inArray(booking.clientId, clients))
		).map((b) => b.id);
		if (bookings.length) {
			const proofs = (
				await db
					.select({ id: payment.proofMediaId })
					.from(payment)
					.where(inArray(payment.bookingId, bookings))
			)
				.map((p) => p.id)
				.filter((id): id is string => !!id);
			await db.delete(payment).where(inArray(payment.bookingId, bookings));
			if (proofs.length) await db.delete(media).where(inArray(media.id, proofs));
			await db.delete(invoice).where(inArray(invoice.bookingId, bookings));
			await db.delete(booking).where(inArray(booking.id, bookings));
		}
		await db.delete(client).where(inArray(client.id, clients));
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

// 1×1 PNG
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

test('DP paid in two parts → Booked → solid on the calendar', async ({ page }) => {
	test.setTimeout(150_000);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);

	// From the board: Booked is refused, "Catat pembayaran DP" opens the form for this booking
	await page.goto('/admin/booking');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: `Pindahkan ${TITLE}` }).click();
	await page.getByRole('menuitem', { name: 'Booked', exact: true }).click();
	await page
		.getByRole('dialog', { name: 'DP belum lunas' })
		.getByRole('link', { name: 'Catat pembayaran DP' })
		.click();
	await expect(page).toHaveURL(/\/admin\/keuangan\/pembayaran\?booking=/);
	const drawer = page.getByRole('dialog', { name: 'Catat pembayaran' });
	await expect(drawer.getByLabel('Booking')).toHaveValue(bookingId);
	await expect(drawer.getByLabel('Untuk')).toContainText('DP 50%');

	// Part 1: Rp 2.000.000 with a proof image
	await drawer.getByLabel('Jumlah').fill('2000000');
	await drawer
		.getByLabel('Bukti pembayaran (opsional)')
		.setInputFiles({ name: 'bukti.png', mimeType: 'image/png', buffer: PNG });
	await expect(drawer.getByText('Terunggah: bukti.png')).toBeVisible({ timeout: 30_000 });
	await drawer.getByRole('button', { name: 'Simpan pembayaran' }).click();
	await expect(page.getByText(/Pembayaran KW\/NM\/\d{4}\/\d{2}\/\d{3,} dicatat\.$/)).toBeVisible();
	const row = page.getByRole('row', { name: new RegExp(TITLE) });
	await expect(row).toContainText(/2\.000\.000/);

	// The proof opens through the permission-checked route (redirect to a presigned GET)
	const href = await row.getByRole('link', { name: /Lihat bukti/ }).getAttribute('href');
	const proof = await page.request.get(href!, { maxRedirects: 0 });
	expect(proof.status()).toBe(303);
	expect(proof.headers().location).toContain('X-Amz-Signature');

	// The booking page: DP partly paid; pay the rest there
	await page.goto(`/admin/booking/${bookingId}`);
	await page.waitForLoadState('networkidle');
	const dpRow = page
		.getByRole('table', { name: 'Jadwal pembayaran' })
		.locator('tr[data-kind="dp"]');
	await expect(dpRow).toContainText('Dibayar Rp');
	await page.getByRole('button', { name: 'Catat pembayaran' }).click();
	const drawer2 = page.getByRole('dialog', { name: 'Catat pembayaran' });
	await expect(drawer2.getByLabel('Untuk')).toContainText(/DP 50%.*3\.000\.000/);
	await drawer2.getByRole('button', { name: 'Simpan pembayaran' }).click();
	await expect(page.getByText(/dicatat\. DP lunas\./)).toBeVisible();

	// Offer to move to Booked
	const offer = page.getByRole('dialog', { name: 'DP lunas' });
	await offer.getByRole('button', { name: 'Pindahkan ke Booked' }).click();
	await expect(page.getByText('Dipindahkan ke Booked.')).toBeVisible();
	await expect(page.getByTestId('stage')).toHaveText('Booked');
	await expect(dpRow).toContainText('Lunas');
	await expect(
		page.getByRole('table', { name: 'Pembayaran booking' }).getByRole('row')
	).toHaveCount(3);

	// Calendar: solid
	await page.goto(`/admin/kalender?bulan=${MONTH}`);
	await page.waitForLoadState('networkidle');
	await expect(
		page.locator(`[data-day="${DAY}"]`).getByRole('button', { name: new RegExp(TITLE) })
	).toHaveAttribute('data-status', 'booked');
});
