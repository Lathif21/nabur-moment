// P1-08 "Done when": a submission creates exactly one booking (and no duplicate client for the
// same WhatsApp); a filled honeypot shows the thank-you page and saves nothing.
// Dev branch only; cleans up its clients and bookings.
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client } from '../../src/lib/server/db/schema/index.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const digits = String(Date.now()).slice(-8);
const phone = `0812${digits}`;
const stored = `62812${digits}`;
const botDigits = String(Date.now() + 7).slice(-8);
const botStored = `62813${botDigits}`;

test.skip(process.env.NEON_BRANCH !== 'dev', 'needs the dev branch');

async function rows(phoneStored: string) {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const clients = await db.select().from(client).where(eq(client.phone, phoneStored));
		const bookings = clients.length
			? await db
					.select()
					.from(booking)
					.where(
						inArray(
							booking.clientId,
							clients.map((c) => c.id)
						)
					)
			: [];
		return { clients, bookings };
	} finally {
		await db.$client.end();
	}
}

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const clients = await db
			.select({ id: client.id })
			.from(client)
			.where(inArray(client.phone, [stored, botStored]));
		const ids = clients.map((c) => c.id);
		if (ids.length) {
			await db.delete(booking).where(inArray(booking.clientId, ids));
			await db.delete(client).where(inArray(client.id, ids));
		}
	} finally {
		await db.$client.end();
	}
});

async function fillForm(page: Page, opts: { phone: string; name: string }) {
	await page.goto('/booking');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Nama').fill(opts.name);
	await page.getByLabel('No. WhatsApp').fill(opts.phone);
	await page.getByLabel('Jenis acara').selectOption('akad');
	await page.getByLabel('Tanggal acara (utama)').fill('2027-03-13');
	await page.getByLabel('Kota').fill('Bandung');
	await page.getByLabel('Pesan').fill('Halo, mau tanya paket akad.');
}

test('inquiry creates one booking; the same WhatsApp reuses the client', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });

	// Validation stays on the form
	await page.goto('/booking');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Kirim' }).click();
	await expect(page.getByText('No. WhatsApp wajib diisi.')).toBeVisible();

	await fillForm(page, { phone, name: 'Uji Inquiry' });
	await page.getByRole('button', { name: 'Kirim' }).click();
	await expect(page).toHaveURL(/\/booking\/terima-kasih$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

	let r = await rows(stored);
	expect(r.clients).toHaveLength(1);
	expect(r.bookings).toHaveLength(1);
	expect(r.bookings[0]).toMatchObject({
		stage: 'inquiry',
		origin: 'website_form',
		eventType: 'akad',
		inquiryMessage: 'Halo, mau tanya paket akad.'
	});

	// Same number written differently: no second client, a second booking
	await fillForm(page, {
		phone: `+62 812-${digits.slice(0, 4)}-${digits.slice(4)}`,
		name: 'Uji Lagi'
	});
	await page.getByRole('button', { name: 'Kirim' }).click();
	await expect(page).toHaveURL(/\/booking\/terima-kasih$/);
	r = await rows(stored);
	expect(r.clients).toHaveLength(1);
	expect(r.bookings).toHaveLength(2);
});

test('a filled honeypot shows thanks and saves nothing', async ({ page }) => {
	await fillForm(page, { phone: `0813${botDigits}`, name: 'Bot' });
	await page
		.locator('#f-website')
		.evaluate((el) => ((el as HTMLInputElement).value = 'https://spam.example'));
	await page.getByRole('button', { name: 'Kirim' }).click();
	await expect(page).toHaveURL(/\/booking\/terima-kasih$/);
	const r = await rows(botStored);
	expect(r.clients).toHaveLength(0);
});
