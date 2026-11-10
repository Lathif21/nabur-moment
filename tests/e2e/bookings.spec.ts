// P2-03 "Done when": cards keep order after refresh; moving to Booked without DP is refused with
// the "Catat pembayaran DP" prompt. Also: same-date warning in the form, Batal needs a reason.
// Dev branch only; removes the clients and bookings it made.
import { expect, test, type Page } from '@playwright/test';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, client } from '../../src/lib/server/db/schema/index.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };
const run = Date.now().toString(36);
const PREFIX = 'E2E CRM Booking';
const clientName = `${PREFIX} ${run}`;
const phone = `08997${String(Date.now()).slice(-7)}`;
// A far-future date no seed booking uses; both test bookings share it (same-date warning)
const DAY = `2032-0${1 + (Date.now() % 9)}-1${Date.now() % 10}`;
const A = `${PREFIX} A ${run}`;
const B = `${PREFIX} B ${run}`;

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

const column = (page: Page, label: string) =>
	page.getByRole('group', { name: new RegExp(`^${label},`) });
const titlesIn = (page: Page, label: string) =>
	column(page, label).getByRole('heading', { level: 3 }).allTextContents();

async function openBoard(page: Page) {
	await page.goto('/admin/booking');
	await page.waitForLoadState('networkidle');
}

async function moveVia(page: Page, title: string, to: string) {
	await page.getByRole('button', { name: `Pindahkan ${title}` }).click();
	await page.getByRole('menuitem', { name: to, exact: true }).click();
}

/** The board is idle again (no move being saved) */
const idle = (page: Page) =>
	expect(page.getByRole('region', { name: 'Pipeline booking' })).toHaveAttribute(
		'aria-busy',
		'false'
	);

test('create bookings, keep order after refresh, refuse Booked without DP, Batal needs a reason', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 1600, height: 1000 });
	await login(page);
	await openBoard(page);

	// Booking A with a new client typed inline
	await page.getByRole('button', { name: 'Booking baru' }).click();
	let drawer = page.getByRole('dialog', { name: 'Booking baru' });
	await drawer.getByRole('button', { name: 'Klien baru' }).click();
	await drawer.getByLabel('Nama klien').fill(clientName);
	await drawer.getByLabel('WhatsApp').fill(phone);
	await drawer.getByLabel('Judul').fill(A);
	await drawer.getByLabel('Tanggal').fill(DAY);
	await drawer.getByLabel('Tanggal').blur();
	await drawer.getByRole('button', { name: 'Buat booking' }).click();
	await expect(page.getByText(`Booking ${A} dibuat.`)).toBeVisible();

	// Booking B for the same client on the same date: the form warns but allows it
	await page.getByRole('button', { name: 'Booking baru' }).click();
	drawer = page.getByRole('dialog', { name: 'Booking baru' });
	await drawer.getByLabel('Cari klien').fill(clientName);
	await drawer.getByRole('button', { name: new RegExp(clientName) }).click();
	await drawer.getByLabel('Judul').fill(B);
	await drawer.getByLabel('Tanggal').fill(DAY);
	await expect(drawer.getByText(/Sudah ada booking di tanggal ini/)).toContainText(A);
	// A typed add-on price flows into the agreed price (the DP is 50% of it)
	await drawer.getByLabel('Tambah add-on').selectOption('custom');
	await drawer.getByLabel('Nama', { exact: true }).fill('Drone');
	await drawer.getByLabel('Harga satuan').fill('2000000');
	await expect(drawer.getByLabel('Harga disepakati')).toHaveValue('2.000.000');
	await drawer.getByRole('button', { name: 'Buat booking' }).click();
	await expect(page.getByText(`Booking ${B} dibuat.`)).toBeVisible();

	// New cards go on top of Inquiry: B above A
	const inquiry = (await titlesIn(page, 'Inquiry')).filter((t) => t.startsWith(PREFIX));
	expect(inquiry).toEqual([B, A]);

	// Move both to Penawaran with the keyboard-friendly menu: each lands at the bottom
	await moveVia(page, A, 'Penawaran');
	await expect(page.getByText('Dipindahkan ke Penawaran.')).toBeVisible();
	await moveVia(page, B, 'Penawaran');
	await expect(column(page, 'Penawaran').getByRole('heading', { name: B })).toBeVisible();
	await idle(page);
	const before = (await titlesIn(page, 'Penawaran')).filter((t) => t.startsWith(PREFIX));
	expect(before).toEqual([A, B]);

	// Same order after a refresh
	await page.reload();
	await page.waitForLoadState('networkidle');
	expect((await titlesIn(page, 'Penawaran')).filter((t) => t.startsWith(PREFIX))).toEqual(before);

	// Booked without DP: refused with the prompt; the card stays in Penawaran
	await moveVia(page, A, 'Booked');
	const dp = page.getByRole('dialog', { name: 'DP belum lunas' });
	await expect(dp).toBeVisible();
	await expect(dp.getByRole('link', { name: 'Catat pembayaran DP' })).toHaveAttribute(
		'href',
		/\/admin\/keuangan\/pembayaran\?booking=/
	);
	await dp.getByRole('button', { name: 'Nanti saja' }).click();
	await expect(column(page, 'Penawaran').getByRole('heading', { name: A })).toBeVisible();
	await expect(column(page, 'Booked').getByRole('heading', { name: A })).toHaveCount(0);

	// Batal asks for a reason
	await moveVia(page, B, 'Batal');
	const lost = page.getByRole('dialog', { name: 'Tandai batal' });
	await lost.getByRole('button', { name: 'Tandai batal' }).click();
	await expect(lost.getByText('Tulis alasan batal.')).toBeVisible();
	await lost.getByLabel(/Alasan batal/).fill('Memilih vendor lain');
	await lost.getByRole('button', { name: 'Tandai batal' }).click();
	await expect(page.getByText('Dipindahkan ke Batal.')).toBeVisible();

	// The list shows B as Batal, A still Penawaran
	await page.goto(`/admin/booking/daftar?q=${encodeURIComponent(`${PREFIX} B ${run}`)}`);
	await expect(page.getByRole('row', { name: new RegExp(B) })).toContainText('Batal');
	await page.goto(`/admin/booking/daftar?q=${encodeURIComponent(A)}`);
	await expect(page.getByRole('row', { name: new RegExp(A) })).toContainText('Penawaran');
});

test('the move action refuses Booked without DP on the server', async ({ page }) => {
	await login(page);
	const db = createDb(process.env.DATABASE_URL!);
	let id: string;
	try {
		const [row] = await db
			.select({ id: booking.id })
			.from(booking)
			.where(eq(booking.title, 'Wedding Nadia & Raka'))
			.limit(1);
		test.skip(!row, 'needs the demo seed (npx tsx scripts/seed-crm.ts)');
		id = row.id;
	} finally {
		await db.$client.end();
	}
	await openBoard(page);
	const res = await page.request.post('/admin/booking?/move', {
		form: { id: id!, to: 'booked' },
		headers: { origin: new URL(page.url()).origin, 'x-sveltekit-action': 'true' }
	});
	const body = await res.json();
	expect(body.type).toBe('failure');
	expect(body.status).toBe(400);
	expect(String(body.data)).toContain('DP belum lunas');
});
