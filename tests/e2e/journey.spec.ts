// P4-02 journey smoke: a website inquiry all the way to money on the dashboard.
// /booking form → Inquiry card on the board → price set on the booking page → DP invoice →
// DP payment → "DP lunas" → Booked → solid on the calendar → invoice PDF + kwitansi → Dashboard.
// Dev branch only; removes the client, booking, invoice and payment it made.
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray, like, sql } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, invoice, payment } from '../../src/lib/server/db/schema/index.ts';
import { dayKeyWib, rupiahShort } from '../../src/lib/format.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const NAME = `E2E CRM Journey ${run}`;
const PHONE = `0899 2${String(Date.now()).slice(-7)}`;
// A far-future day no seed uses
const MONTH = '2035-05';
const DAY = `${MONTH}-1${Date.now() % 10}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const clients = (
			await db.select({ id: client.id }).from(client).where(like(client.name, 'E2E CRM Journey%'))
		).map((c) => c.id);
		if (!clients.length) return;
		const bookings = (
			await db.select({ id: booking.id }).from(booking).where(inArray(booking.clientId, clients))
		).map((b) => b.id);
		if (bookings.length) {
			await db.delete(payment).where(inArray(payment.bookingId, bookings));
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

async function monthIncome(month: string) {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const { rows } = await db.execute<{ total: string }>(
			sql`select coalesce(sum(amount), 0) as total from payment where to_char(paid_on, 'YYYY-MM') = ${month}`
		);
		return Number(rows[0].total);
	} finally {
		await db.$client.end();
	}
}

test('inquiry → board → DP → Booked → calendar → PDFs → dashboard', async ({ page }) => {
	test.setTimeout(180_000);

	// 1. The couple sends the inquiry form on the website
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/booking');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Nama').fill(NAME);
	await page.getByLabel('No. WhatsApp').fill(PHONE);
	await page.getByLabel('Jenis acara').selectOption('akad');
	await page.getByLabel('Tanggal acara (utama)').fill(DAY);
	await page.getByLabel('Kota').fill('Bandung');
	await page.getByLabel('Pesan').fill('Halo, mau tanya paket akad.');
	await page.getByRole('button', { name: 'Kirim' }).click();
	await expect(page).toHaveURL(/\/booking\/terima-kasih$/);

	const db = createDb(process.env.DATABASE_URL!);
	const made = await db
		.select({ id: booking.id, title: booking.title })
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(eq(client.name, NAME))
		.finally(() => db.$client.end());
	expect(made).toHaveLength(1);
	const { id, title } = made[0];

	// 2. The owner sees it in Inquiry on the board and opens it
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);
	await page.goto('/admin/booking');
	await page.waitForLoadState('networkidle');
	const inquiry = page.getByRole('group', { name: /^Inquiry,/ });
	await inquiry.getByRole('link', { name: title, exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/booking/${id}$`));
	await page.waitForLoadState('networkidle');
	await expect(page.getByText('Pesan dari formulir website')).toBeVisible();

	// 3. Agree on a price: Rp 8.000.000 → DP 4.000.000
	await page.getByRole('button', { name: 'Ubah' }).click();
	const edit = page.getByRole('dialog', { name: 'Ubah booking' });
	await edit.getByLabel('Harga disepakati').fill('8000000');
	await edit.getByRole('button', { name: 'Simpan' }).click();
	await expect(page.getByText('Booking disimpan.')).toBeVisible();
	const schedule = page.getByRole('table', { name: 'Jadwal pembayaran' });
	await expect(schedule.locator('tr[data-kind="dp"]')).toContainText(/4\.000\.000/);

	// 4. DP invoice, then the DP payment against it
	await schedule.getByRole('button', { name: 'Buat invoice DP 50%' }).click();
	await page
		.getByRole('dialog', { name: 'Buat invoice DP 50%' })
		.getByRole('button', { name: 'Buat invoice' })
		.click();
	await expect(page.getByText(/Invoice INV\/NM\/.* dibuat\./)).toBeVisible();

	await page.getByRole('button', { name: 'Catat pembayaran' }).click();
	const pay = page.getByRole('dialog', { name: 'Catat pembayaran' });
	await expect(pay.getByLabel('Untuk')).toContainText(/INV\/NM\/.*4\.000\.000/);
	await pay.getByRole('button', { name: 'Simpan pembayaran' }).click();
	await expect(page.getByText(/dicatat\. DP lunas\./)).toBeVisible();

	// 5. DP paid → move to Booked from the prompt
	await page
		.getByRole('dialog', { name: 'DP lunas' })
		.getByRole('button', { name: 'Pindahkan ke Booked' })
		.click();
	await expect(page.getByTestId('stage')).toHaveText('Booked');
	await expect(schedule.locator('tr[data-kind="dp"]')).toContainText('Lunas');

	// 6. Calendar: the session is solid (booked)
	await page.goto(`/admin/kalender?bulan=${MONTH}`);
	await page.waitForLoadState('networkidle');
	await expect(
		page.locator(`[data-day="${DAY}"]`).getByRole('button', { name: new RegExp(title) })
	).toHaveAttribute('data-status', 'booked');

	// 7. Invoice (Lunas) and kwitansi as PDFs
	await page.goto(`/admin/booking/${id}`);
	await page.waitForLoadState('networkidle');
	await page
		.getByRole('table', { name: 'Invoice booking' })
		.getByRole('link', { name: /^INV\/NM\// })
		.click();
	await expect(page.getByTestId('invoice-status')).toHaveText('Lunas');
	const pdfHref = await page.getByRole('link', { name: 'Unduh PDF' }).getAttribute('href');
	const pdf = await page.request.get(pdfHref!);
	expect(pdf.headers()['content-type']).toBe('application/pdf');
	expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

	await page.goto(`/admin/booking/${id}`);
	await page.waitForLoadState('networkidle');
	const kwHref = await page
		.getByRole('link', { name: /^Unduh kwitansi KW\/NM\// })
		.getAttribute('href');
	const kw = await page.request.get(kwHref!);
	expect((await kw.body()).subarray(0, 5).toString()).toBe('%PDF-');

	// 8. Dashboard: this month's income includes the DP (paid today)
	const month = dayKeyWib().slice(0, 7);
	const income = await monthIncome(month);
	expect(income).toBeGreaterThanOrEqual(4_000_000);
	await page.goto('/admin?period=month');
	await expect(
		page
			.getByRole('group', { name: 'Ringkasan keuangan' })
			.locator('div', { has: page.getByText('Pemasukan', { exact: true }) })
			.first()
	).toContainText(rupiahShort(income));
});
