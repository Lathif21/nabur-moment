// P4-02 permission smoke for CRM + Keuangan: a role that may only LOOK at bookings and payments
// sees no write buttons and gets 403 from every other page, API and form action (the server
// checks requirePerm; hiding buttons is only the UI side). Dev branch only. Its own role and user
// per run, removed afterwards (independent of global-setup).
import { expect, test, type Page } from '@playwright/test';
import { like } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { booking, role, user } from '../../src/lib/server/db/schema/index.ts';
import {
	createRole,
	setRolePermissions,
	setUserActive,
	setUserRoles
} from '../../src/lib/server/services/access.ts';
import { createUser } from '../../src/lib/server/services/users.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const run = Date.now().toString(36);
const EMAIL = `perm-crm-${run}@naburmoment.test`;
const PASSWORD = 'perm-crm-rahasia-123';
const ROLE = `E2E CRM Perm ${run} (booking + pembayaran lihat)`;

test.skip(process.env.NEON_BRANCH !== 'dev', 'needs the dev branch');

let bookingId = '';

test.beforeAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const r = await createRole(db, { name: ROLE, description: 'Dipakai tes e2e izin CRM' });
		await setRolePermissions(db, r.id, [
			{ module: 'bookings', action: 'read' },
			{ module: 'payments', action: 'read' }
		]);
		const u = await createUser(db, { name: 'Perm CRM (e2e)', email: EMAIL, password: PASSWORD });
		await setUserActive(db, u.id, true);
		await setUserRoles(db, u.id, [r.id]);
		// Any booking will do (the demo seed has plenty)
		const [b] = await db.select({ id: booking.id }).from(booking).limit(1);
		bookingId = b?.id ?? '';
	} finally {
		await db.$client.end();
	}
});

test.afterAll(async () => {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		// user first: user_role cascades from user but restricts the role
		await db.delete(user).where(like(user.email, 'perm-crm-%@naburmoment.test'));
		await db.delete(role).where(like(role.name, 'E2E CRM Perm %'));
	} finally {
		await db.$client.end();
	}
});

async function login(page: Page) {
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(EMAIL);
	await page.getByLabel('Kata sandi').fill(PASSWORD);
	await page.getByRole('button', { name: 'Masuk' }).click();
	// No Dashboard permission: login lands on the first allowed page
	await expect(page).toHaveURL(/\/admin\/booking$/);
}

test('read-only booking + payments role: no write buttons, 403 everywhere else', async ({
	page
}) => {
	test.skip(!bookingId, 'needs at least one booking (npx tsx scripts/seed-crm.ts)');
	test.setTimeout(90_000);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await login(page);
	const origin = new URL(page.url()).origin;

	// Sidebar: only what the role allows
	const nav = page.getByRole('navigation', { name: 'Menu admin' });
	await expect(nav.getByRole('link', { name: 'Booking' })).toBeVisible();
	await expect(nav.getByRole('link', { name: 'Pembayaran' })).toBeVisible();
	for (const hidden of ['Dashboard', 'Kalender', 'Klien', 'Invoice', 'Pengeluaran', 'Laba Rugi'])
		await expect(nav.getByRole('link', { name: hidden, exact: true })).toHaveCount(0);

	// Board and booking page: reading works, no write controls
	await expect(page.getByRole('button', { name: 'Booking baru' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Pindahkan / })).toHaveCount(0);
	await page.goto(`/admin/booking/${bookingId}`);
	await page.waitForLoadState('networkidle');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	for (const name of [
		'Ubah',
		'Pindah tahap',
		'Catat pembayaran',
		'Invoice lain',
		'Tambah biaya',
		'Simpan aktivitas',
		'Simpan pengiriman'
	])
		await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Buat invoice/ })).toHaveCount(0);

	// Pembayaran: the list, no form or delete
	await page.goto('/admin/keuangan/pembayaran');
	await expect(page.getByRole('heading', { level: 1, name: 'Pembayaran' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Catat pembayaran' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /^Hapus / })).toHaveCount(0);

	// Pages outside the role: 403
	for (const path of [
		'/admin/kalender',
		'/admin/klien',
		'/admin/keuangan/invoice',
		'/admin/keuangan/pengeluaran',
		'/admin/keuangan/laba-rugi',
		'/admin/pengaturan/bisnis'
	]) {
		const res = await page.request.get(path, { maxRedirects: 0 });
		expect(res.status(), path).toBe(403);
	}

	// Form actions and APIs that write: 403 even when posted directly
	const post = (path: string, form: Record<string, string>) =>
		page.request.post(path, { form, headers: { origin } });
	const writes: [string, Record<string, string>][] = [
		['/admin/booking?/create', { title: 'x' }],
		['/admin/booking?/move', { id: bookingId, to: 'consultation' }],
		[`/admin/booking/${bookingId}?/update`, { id: bookingId }],
		[`/admin/booking/${bookingId}?/activity`, { bookingId, type: 'note', body: 'x' }],
		[`/admin/booking/${bookingId}?/invoice`, { installmentId: bookingId }],
		[`/admin/booking/${bookingId}?/payment`, { bookingId }],
		[`/admin/booking/${bookingId}?/expense`, { bookingId }],
		['/admin/keuangan/pembayaran?/payment', { bookingId }],
		['/admin/keuangan/pembayaran?/delete', { id: bookingId }]
	];
	for (const [path, form] of writes) {
		const res = await post(path, form);
		expect(res.status(), path).toBe(403);
	}
	const upload = await page.request.post('/admin/api/payment-proofs', {
		data: { filename: 'x.png', mime: 'image/png', bytes: 10 },
		headers: { origin }
	});
	expect(upload.status()).toBe(403);
	const receipts = await page.request.post('/admin/api/expense-receipts', {
		data: { filename: 'x.png', mime: 'image/png', bytes: 10 },
		headers: { origin }
	});
	expect(receipts.status()).toBe(403);
});
