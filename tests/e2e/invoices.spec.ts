// P3-02: create an invoice from the DP installment and a custom one from the booking page, mark it
// sent, void it, find them in the list; no access without the invoices permission. (Numbering under concurrency + void with payments: the DB
// spec invoices.db.spec.ts.) Dev branch only; removes what it made (counter numbers stay used).
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, invoice } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';
import { STAFF_EMAIL, STAFF_PASSWORD } from './global-setup.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Inv';
const TITLE = `${PREFIX} ${run}`;

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
				newClientPhone: `08996${String(Date.now()).slice(-7)}`,
				title: TITLE,
				eventType: 'wedding',
				agreedPrice: '10000000',
				sessions: JSON.stringify([{ eventType: 'akad', date: '2032-06-06' }]),
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
		const ids = (
			await db
				.select({ id: client.id })
				.from(client)
				.where(like(client.name, `${PREFIX}%`))
		).map((c) => c.id);
		if (ids.length) {
			const bookings = (
				await db.select({ id: booking.id }).from(booking).where(inArray(booking.clientId, ids))
			).map((b) => b.id);
			if (bookings.length) await db.delete(invoice).where(inArray(invoice.bookingId, bookings));
			await db.delete(booking).where(inArray(booking.clientId, ids));
			await db.delete(client).where(inArray(client.id, ids));
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

test('DP invoice: create, mark sent, void; custom invoice; list', async ({ page }) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await login(page);
	await page.goto(`/admin/booking/${bookingId}`);
	await page.waitForLoadState('networkidle');

	// DP invoice from the schedule
	const schedule = page.getByRole('table', { name: 'Jadwal pembayaran' });
	await schedule.getByRole('button', { name: 'Buat invoice DP 50%' }).click();
	const modal = page.getByRole('dialog', { name: 'Buat invoice DP 50%' });
	await expect(modal).toContainText(/5\.000\.000/);
	await modal.getByRole('button', { name: 'Buat invoice' }).click();
	await expect(page.getByText(/Invoice INV\/NM\/\d{4}\/\d{2}\/\d{3,} dibuat\./)).toBeVisible();
	const dpLink = schedule.locator('tr[data-kind="dp"]').getByRole('link', { name: /^INV\/NM\// });
	await expect(dpLink).toBeVisible();
	const number = (await dpLink.textContent())!.trim();

	// The invoice page: draft → sent → void
	await dpLink.click();
	await expect(page.getByRole('heading', { level: 1, name: number })).toBeVisible();
	await page.waitForLoadState('networkidle');
	await expect(page.getByTestId('invoice-status')).toHaveText('Draf');
	await expect(page.getByTestId('invoice-total')).toContainText(/5\.000\.000/);
	await page.getByRole('button', { name: 'Tandai terkirim' }).click();
	await expect(page.getByTestId('invoice-status')).toHaveText('Terkirim');
	await expect(page.getByRole('button', { name: 'Tandai terkirim' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Batalkan (void)' }).click();
	await page.getByRole('alertdialog').getByRole('button', { name: 'Batalkan invoice' }).click();
	await expect(page.getByTestId('invoice-status')).toHaveText('Dibatalkan');

	// Back on the booking: the DP can be billed again; a custom invoice
	await page.getByRole('link', { name: TITLE }).click();
	await page.waitForLoadState('networkidle');
	await expect(schedule.getByRole('button', { name: 'Buat invoice DP 50%' })).toBeVisible();
	await page.getByRole('button', { name: 'Invoice lain' }).click();
	const drawer = page.getByRole('dialog', { name: 'Invoice lain' });
	await drawer.getByLabel('Keterangan').fill('Tambahan 2 jam liputan');
	// Changing a date keeps the lines (the open-effect tracks only `open`)
	await drawer.getByLabel('Tanggal invoice').fill('2032-05-01');
	await expect(drawer.getByLabel('Keterangan')).toHaveValue('Tambahan 2 jam liputan');
	await drawer.getByLabel('Jatuh tempo').fill('2032-05-15');
	await drawer.getByLabel('Harga satuan').fill('750000');
	await drawer.getByLabel('Jumlah').fill('2');
	await expect(drawer.getByTestId('custom-invoice-total')).toContainText(/1\.500\.000/);
	await drawer.getByRole('button', { name: 'Buat invoice' }).click();
	await expect(page.getByText(/Invoice INV\/NM\/.* dibuat\./)).toBeVisible();
	const invoices = page.getByRole('table', { name: 'Invoice booking' });
	await expect(invoices.getByRole('row')).toHaveCount(3);

	// The list finds both by booking title
	await page.goto(`/admin/keuangan/invoice?q=${encodeURIComponent(TITLE)}`);
	await expect(
		page.getByRole('row', { name: new RegExp(number.replace(/\//g, '\\/')) })
	).toContainText('Dibatalkan');
	await expect(page.getByRole('row', { name: /Lainnya/ })).toContainText('Draf');
});

test('a user without invoice access cannot open or void invoices', async ({ page }) => {
	const db = createDb(process.env.DATABASE_URL!);
	const id = await db
		.select({ id: invoice.id })
		.from(invoice)
		.where(eq(invoice.bookingId, bookingId))
		.limit(1)
		.then((rows) => rows[0]?.id ?? '')
		.finally(() => db.$client.end());
	test.skip(!id, 'needs the invoice from the first test');

	// The staff role only has clients:read (global-setup)
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(STAFF_EMAIL);
	await page.getByLabel('Kata sandi').fill(STAFF_PASSWORD);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(/\/admin\/klien$/);
	await expect(page.getByRole('link', { name: 'Invoice' })).toHaveCount(0);

	const view = await page.request.get(`/admin/keuangan/invoice/${id}`);
	expect(view.status()).toBe(403);
	const res = await page.request.post(`/admin/keuangan/invoice/${id}?/void`, {
		form: { id },
		headers: { origin: new URL(page.url()).origin }
	});
	expect(res.status()).toBe(403);
});
