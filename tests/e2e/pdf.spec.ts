// P3-03 "Done when": both PDFs render with logo, numbers, amounts in words and bank details.
// The page-level part: Pengaturan → Bisnis & Keuangan saves the BCA account, the invoice page and
// the payment rows download real PDFs. (Document content: src/lib/server/pdf/pdf.spec.ts.)
// Dev branch only; removes the booking it made.
import { expect, test, type Page } from '@playwright/test';
import { inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, invoice, payment } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { paymentSchema } from '../../src/lib/schemas/finance.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';
import { listSchedule } from '../../src/lib/server/services/installments.ts';
import { createInstallmentInvoice } from '../../src/lib/server/services/invoices.ts';
import { recordPayment } from '../../src/lib/server/services/payments.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Pdf';
const TITLE = `${PREFIX} ${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let bookingId = '';
let invoiceId = '';
let paymentId = '';

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const made = await createBooking(
			db,
			bookingSchema.parse({
				newClientName: `${PREFIX} ${run}`,
				newClientPhone: `08994${String(Date.now()).slice(-7)}`,
				title: TITLE,
				eventType: 'wedding',
				agreedPrice: '8000000',
				sessions: JSON.stringify([{ eventType: 'akad', date: '2034-10-10' }]),
				addons: '[]'
			}),
			null
		);
		bookingId = made.id;
		const [dp] = await listSchedule(db, made.id);
		const inv = await createInstallmentInvoice(
			db,
			{ installmentId: dp.id, issueDate: '2034-09-01', dueDate: '2034-09-08', notes: null },
			null
		);
		invoiceId = inv.id;
		const p = await recordPayment(
			db,
			paymentSchema.parse({
				bookingId: made.id,
				target: `inv:${inv.id}`,
				paidOn: '2034-09-02',
				amount: '4000000',
				method: 'transfer'
			}),
			null
		);
		paymentId = p.id;
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

test('settings save the BCA account; invoice and kwitansi download as PDFs', async ({ page }) => {
	test.setTimeout(90_000);
	await login(page);

	await page.goto('/admin/pengaturan/bisnis');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Nomor rekening').fill('123-456-7890');
	await page.getByLabel('Atas nama').fill('Nabur Moment');
	await page.getByLabel('WhatsApp').fill('0812 3456 7890');
	await page.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(page.getByText('Pengaturan bisnis disimpan.')).toBeVisible();
	await page.reload();
	await expect(page.getByLabel('Nomor rekening')).toHaveValue('1234567890');
	await expect(page.getByText('belum diisi')).toHaveCount(0);

	// Wrong input is refused field by field
	await page.getByLabel('WhatsApp').fill('12');
	await page.getByRole('button', { name: 'Simpan', exact: true }).click();
	await expect(page.getByText('Nomor WhatsApp tidak valid.')).toBeVisible();

	// Invoice page → Unduh PDF
	await page.goto(`/admin/keuangan/invoice/${invoiceId}`);
	await page.waitForLoadState('networkidle');
	const href = await page.getByRole('link', { name: 'Unduh PDF' }).getAttribute('href');
	const pdf = await page.request.get(href!);
	expect(pdf.status()).toBe(200);
	expect(pdf.headers()['content-type']).toBe('application/pdf');
	expect(pdf.headers()['content-disposition']).toMatch(
		/attachment; filename="INV-NM-2034-09-\d+\.pdf"/
	);
	expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

	// Booking page → Unduh kwitansi
	await page.goto(`/admin/booking/${bookingId}`);
	await page.waitForLoadState('networkidle');
	const kw = await page
		.getByRole('link', { name: /^Unduh kwitansi KW\/NM\/2034\/09\// })
		.getAttribute('href');
	expect(kw).toContain(paymentId);
	const receipt = await page.request.get(kw!);
	expect(receipt.status()).toBe(200);
	expect(receipt.headers()['content-disposition']).toMatch(/filename="KW-NM-2034-09-\d+\.pdf"/);
	expect((await receipt.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
