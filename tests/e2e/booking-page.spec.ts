// P2-04 "Done when": notes and stage changes appear newest first with author and time (WIB).
// Also: the board card links to the booking page; the Pengiriman card saves; the P3-01 schedule.
// Dev branch only; removes the client and booking it made.
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client, user } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Page';
const TITLE = `${PREFIX} ${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let bookingId = '';
let ownerName = '';

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const [me] = await db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.email, owner.email));
		ownerName = me.name;
		const made = await createBooking(
			db,
			bookingSchema.parse({
				newClientName: `${PREFIX} ${run}`,
				newClientPhone: `08997${String(Date.now()).slice(-7)}`,
				title: TITLE,
				eventType: 'wedding',
				agreedPrice: '7500000',
				sessions: JSON.stringify([{ eventType: 'akad', date: '2032-04-04', venue: 'Masjid Raya' }]),
				addons: '[]'
			}),
			me.id
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

test('notes and stage changes show newest first with author and WIB time', async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);

	// The board card title opens the booking page
	await page.goto('/admin/booking');
	await page.waitForLoadState('networkidle');
	await page.getByRole('link', { name: TITLE, exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/booking/${bookingId}$`));
	await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
	await expect(page.getByText('Masjid Raya')).toBeVisible();

	// P3-01: the schedule, DP 50% + pelunasan due on Hari H
	const schedule = page.getByRole('table', { name: 'Jadwal pembayaran' });
	await expect(schedule.locator('tr[data-kind="dp"]')).toContainText(/3\.750\.000/);
	await expect(schedule.locator('tr[data-kind="pelunasan"]')).toContainText(/3\.750\.000/);
	await expect(schedule.locator('tr[data-kind="pelunasan"]')).toContainText('4 Apr 2032');
	await page.waitForLoadState('networkidle');

	// A note: empty is refused, then saved
	await page.getByRole('button', { name: 'Simpan aktivitas' }).click();
	await expect(page.getByText('Tulis isi catatan.')).toBeVisible();
	await page.getByLabel('Isi').fill('Sudah kirim pricelist');
	await page.getByRole('button', { name: 'Simpan aktivitas' }).click();
	await expect(page.getByText('Aktivitas dicatat.')).toBeVisible();
	await expect(page.getByLabel('Isi')).toHaveValue('');

	// A stage change from the page
	await page.getByRole('button', { name: 'Pindah tahap' }).click();
	await page.getByRole('menuitem', { name: 'Konsultasi', exact: true }).click();
	await expect(page.getByText('Dipindahkan ke Konsultasi.')).toBeVisible();
	await expect(page.getByTestId('stage')).toHaveText('Konsultasi');

	async function expectTimeline() {
		const items = page.getByRole('list', { name: 'Aktivitas booking' }).getByRole('listitem');
		await expect(items).toHaveCount(3);
		await expect(items.nth(0)).toContainText('Pindah tahap');
		await expect(items.nth(0)).toContainText('Inquiry → Konsultasi');
		await expect(items.nth(1)).toContainText('Catatan');
		await expect(items.nth(1)).toContainText('Sudah kirim pricelist');
		await expect(items.nth(2)).toContainText('Sistem');
		for (const i of [0, 1]) {
			await expect(items.nth(i)).toContainText(ownerName);
			await expect(items.nth(i)).toContainText(/\d{2}:\d{2} WIB/);
		}
	}
	await expectTimeline();
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expectTimeline();

	// Booked without DP is refused here too
	await page.getByRole('button', { name: 'Pindah tahap' }).click();
	await page.getByRole('menuitem', { name: 'Booked', exact: true }).click();
	const dp = page.getByRole('dialog', { name: 'DP belum lunas' });
	await expect(dp).toBeVisible();
	await dp.getByRole('button', { name: 'Nanti saja' }).click();
	await expect(page.getByTestId('stage')).toHaveText('Konsultasi');

	// Pengiriman
	await page.getByLabel('Link hasil (Google Drive)').fill('drive.google.com/abc');
	await page.getByRole('button', { name: 'Simpan pengiriman' }).click();
	await expect(page.getByText('Link harus diawali https://')).toBeVisible();
	await page.getByLabel('Link hasil (Google Drive)').fill('https://drive.google.com/abc');
	await page.getByLabel('Raw dikirim').fill('2032-04-10');
	await page.getByRole('button', { name: 'Simpan pengiriman' }).click();
	await expect(page.getByText('Pengiriman disimpan.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Buka link hasil' })).toHaveAttribute(
		'href',
		'https://drive.google.com/abc'
	);
});
