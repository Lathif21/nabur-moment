// P2-05 "Done when": a day with two bookings shows the warning; tentative bookings can be hidden.
// Also: booked = solid / tentative = outlined, the drawer links to the booking, phone agenda.
// Dev branch only; removes the clients and bookings it made.
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client } from '../../src/lib/server/db/schema/index.ts';
import { bookingSchema } from '../../src/lib/schemas/crm.ts';
import { createBooking } from '../../src/lib/server/services/bookings.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Cal';
const MONTH = '2034-03';
const DAY = '2034-03-10';
const BOOKED = `${PREFIX} Booked ${run}`;
const TENTATIVE = `${PREFIX} Tentatif ${run}`;

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

let bookedId = '';

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const make = (title: string, n: string, eventType: string, startTime: string) =>
			createBooking(
				db,
				bookingSchema.parse({
					newClientName: `${PREFIX} ${n} ${run}`,
					newClientPhone: `0899${n}${String(Date.now()).slice(-7)}`,
					title,
					eventType: 'wedding',
					agreedPrice: '5000000',
					sessions: JSON.stringify([{ eventType, date: DAY, startTime }]),
					addons: '[]'
				}),
				null
			);
		const a = await make(BOOKED, '1', 'akad', '08:00');
		await make(TENTATIVE, '2', 'resepsi', '19:00');
		// A paid DP (payments arrive in P3-04)
		await db.update(booking).set({ bookedAt: new Date() }).where(eq(booking.id, a.id));
		bookedId = a.id;
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

test('two bookings on a day warn; tentative can be hidden', async ({ page }) => {
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);
	await page.goto(`/admin/kalender?bulan=${MONTH}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { name: 'Maret 2034' })).toBeVisible();

	const day = page.locator(`[data-day="${DAY}"]`);
	await expect(day.getByTestId(`busy-${DAY}`)).toContainText('2');
	await expect(day.getByTestId(`busy-${DAY}`)).toContainText('booking di tanggal ini');
	await expect(day.getByRole('button', { name: new RegExp(BOOKED) })).toHaveAttribute(
		'data-status',
		'booked'
	);
	await expect(day.getByRole('button', { name: new RegExp(TENTATIVE) })).toHaveAttribute(
		'data-status',
		'tentative'
	);

	// Hide tentative: the outlined one goes, the warning stays
	await page.getByLabel('Tampilkan tentatif').uncheck();
	await expect(page).toHaveURL(/tentatif=0/);
	await expect(day.getByRole('button', { name: new RegExp(TENTATIVE) })).toHaveCount(0);
	await expect(day.getByRole('button', { name: new RegExp(BOOKED) })).toBeVisible();
	await expect(day.getByTestId(`busy-${DAY}`)).toContainText('2');

	// The filter survives month navigation
	await page.getByRole('link', { name: 'Bulan berikutnya' }).click();
	await expect(page).toHaveURL(/bulan=2034-04.*tentatif=0/);
	await page.getByRole('link', { name: 'Bulan sebelumnya' }).click();
	await expect(page).toHaveURL(/bulan=2034-03.*tentatif=0/);
	await expect(page.getByRole('heading', { name: 'Maret 2034' })).toBeVisible();
	await expect(page.getByLabel('Tampilkan tentatif')).not.toBeChecked();

	// Show it again, open the booking drawer
	await page.getByLabel('Tampilkan tentatif').check();
	await expect(day.getByRole('button', { name: new RegExp(TENTATIVE) })).toBeVisible();
	await day.getByRole('button', { name: new RegExp(BOOKED) }).click();
	const drawer = page.getByRole('dialog', { name: BOOKED });
	await expect(drawer).toContainText('DP lunas');
	await expect(drawer).toContainText('Ada 2 booking');
	await expect(drawer.getByRole('link', { name: 'Buka booking' })).toHaveAttribute(
		'href',
		`/admin/booking/${bookedId}`
	);
});

test('phones get an agenda with the same warning', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await login(page);
	await page.goto(`/admin/kalender?bulan=${MONTH}`);
	await page.waitForLoadState('networkidle');
	const agenda = page.getByRole('list', { name: 'Agenda Maret 2034' });
	await expect(agenda).toBeVisible();
	const item = agenda.getByRole('listitem').filter({ hasText: BOOKED });
	await expect(item.getByTestId(`busy-${DAY}`)).toBeVisible();
	await expect(item.getByRole('button', { name: new RegExp(TENTATIVE) })).toBeVisible();
});
