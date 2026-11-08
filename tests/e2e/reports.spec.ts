// P3-06 "Done when": Dashboard totals match the sum of payments / expenses for the period (checked
// against the demo seed: npx tsx scripts/seed-crm.ts). P3-07 "Done when": the Laba Rugi year total
// equals the Dashboard for Tahunan of the same year. Expected values come from plain SQL sums.
import { expect, test, type Page } from '@playwright/test';
import { sql } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { dayKeyWib, rupiah, rupiahShort } from '../../src/lib/format.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const owner = { email: process.env.E2E_EMAIL ?? '', password: process.env.E2E_PASSWORD ?? '' };

test.skip(
	process.env.NEON_BRANCH !== 'dev' || !owner.email,
	'needs the dev branch and E2E_EMAIL / E2E_PASSWORD'
);

/** Raw sums for [from, to], independent of the report service */
async function sums(from: string, to: string) {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const { rows } = await db.execute<{ income: string; direct: string; overhead: string }>(sql`
			select
				(select coalesce(sum(amount), 0) from payment where paid_on between ${from}::date and ${to}::date) as income,
				(select coalesce(sum(amount), 0) from expense where booking_id is not null and spent_on between ${from}::date and ${to}::date) as direct,
				(select coalesce(sum(amount), 0) from expense where booking_id is null and spent_on between ${from}::date and ${to}::date) as overhead`);
		const income = Number(rows[0].income);
		const expenses = Number(rows[0].direct) + Number(rows[0].overhead);
		return {
			income,
			direct: Number(rows[0].direct),
			overhead: Number(rows[0].overhead),
			expenses,
			profit: income - expenses
		};
	} finally {
		await db.$client.end();
	}
}

async function login(page: Page) {
	await page.goto('/admin/login');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(owner.email);
	await page.getByLabel('Kata sandi').fill(owner.password);
	await page.getByRole('button', { name: 'Masuk' }).click();
	await expect(page).toHaveURL(/\/admin$/);
}

const tile = (page: Page, label: string) =>
	page
		.getByRole('group', { name: 'Ringkasan keuangan' })
		.locator('div', { has: page.getByText(label, { exact: true }) })
		.first();

test('Bulanan and Tahunan tiles match the payments and expenses of the period', async ({
	page
}) => {
	const today = dayKeyWib();
	const month = today.slice(0, 7);
	const monthEnd = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0))
		.toISOString()
		.slice(0, 10);
	const m = await sums(`${month}-01`, monthEnd);
	expect(m.income + m.expenses, 'the demo seed has money this month').toBeGreaterThan(0);

	await login(page);
	await page.goto('/admin?period=month');
	await expect(tile(page, 'Pemasukan')).toContainText(rupiahShort(m.income));
	await expect(tile(page, 'Pengeluaran')).toContainText(rupiahShort(m.expenses));
	await expect(tile(page, 'Laba bersih')).toContainText(rupiahShort(m.profit));
	// The chart's table view holds the same month
	await page.getByText('Lihat sebagai tabel').click();
	await expect(
		page
			.getByRole('table', { name: /\(tabel\)/ })
			.getByRole('row')
			.last()
	).toContainText(rupiah(m.income));

	// Tahunan vs Laba Rugi
	const year = today.slice(0, 4);
	const y = await sums(`${year}-01-01`, `${year}-12-31`);
	await page.goto(`/admin?period=year&from=${year}-01-01`);
	await expect(tile(page, 'Pemasukan')).toContainText(rupiahShort(y.income));
	await expect(tile(page, 'Laba bersih')).toContainText(rupiahShort(y.profit));

	await page.goto(`/admin/keuangan/laba-rugi?tahun=${year}`);
	const total = page.locator('tr[data-month="total"]');
	await expect(total).toContainText(rupiah(y.income));
	await expect(total).toContainText(rupiah(y.direct));
	await expect(total).toContainText(rupiah(y.overhead));
	await expect(total).toContainText(rupiah(y.profit));
	await expect(page.locator(`tr[data-month="${month}"]`)).toContainText(rupiah(m.income));
});
