// DB spec for the reports (P3-06 / P3-07). Neon `dev` branch (NEON_BRANCH=dev) or localhost only;
// every case runs in a rolled-back transaction, in the year 2097 so no other data counts.
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { expenseSchema, paymentSchema } from '../../schemas/finance';
import { createDb, type Tx } from '../db/client';
import { resolvePeriod } from '../../period';
import { createBooking } from './bookings';
import { createExpense, listExpenseCategories } from './expenses';
import { listSchedule } from './installments';
import { recordPayment } from './payments';
import { moneySeries, periodTotals, receivables, yearReport } from './reports';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const isDevDb =
	!!url &&
	(process.env.NEON_BRANCH === 'dev' || ['localhost', '127.0.0.1'].includes(new URL(url).hostname));

class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>) {
	const db = createDb(url!);
	try {
		await db.transaction(async (tx) => {
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

async function seed(tx: Tx) {
	const made = await createBooking(
		tx,
		bookingSchema.parse({
			newClientName: 'E2E CRM Spec Report',
			newClientPhone: '0899-7009-0001',
			title: 'E2E CRM Report',
			eventType: 'wedding',
			agreedPrice: '20000000',
			sessions: JSON.stringify([{ eventType: 'akad', date: '2097-06-20' }]),
			addons: '[]'
		}),
		null
	);
	const [dp, pelunasan] = await listSchedule(tx, made.id);
	const pay = (target: string, amount: number, paidOn: string) =>
		recordPayment(
			tx,
			paymentSchema.parse({
				bookingId: made.id,
				target,
				paidOn,
				amount: String(amount),
				method: 'transfer'
			}),
			null
		);
	await pay(`inst:${dp.id}`, 10_000_000, '2097-03-15');
	await pay(`inst:${pelunasan.id}`, 4_000_000, '2097-06-20');
	const [cat] = await listExpenseCategories(tx);
	const spend = (amount: number, spentOn: string, bookingId: string | null) =>
		createExpense(
			tx,
			expenseSchema.parse({
				spentOn,
				amount: String(amount),
				categoryId: cat.id,
				bookingId: bookingId ?? '',
				method: 'cash'
			}),
			null
		);
	await spend(2_500_000, '2097-06-20', made.id);
	await spend(600_000, '2097-06-02', null);
	await spend(400_000, '2097-03-31', null);
	return made;
}

describe.runIf(isDevDb)('reports', () => {
	it('period totals are the sums of payments and expenses dated in the period', () =>
		inRollback(async (tx) => {
			await seed(tx);
			const june = resolvePeriod({ period: 'month', from: '2097-06-10' }, { today: '2097-12-31' });
			expect(await periodTotals(tx, june.from, june.to)).toEqual({
				income: 4_000_000,
				direct: 2_500_000,
				overhead: 600_000,
				expenses: 3_100_000,
				profit: 900_000
			});
			const march = await periodTotals(tx, '2097-03-01', '2097-03-31');
			expect(march).toMatchObject({ income: 10_000_000, expenses: 400_000, profit: 9_600_000 });

			// Piutang: 20 juta − paid by then
			expect(await receivables(tx, '2097-04-01')).toBeGreaterThanOrEqual(10_000_000);
			const before = await receivables(tx, '2097-04-01');
			const after = await receivables(tx, '2097-06-30');
			expect(before - after).toBe(4_000_000);

			// The chart buckets add up to the period
			const series = await moneySeries(tx, '2097-01-01', '2097-12-31', 'month');
			expect(series).toHaveLength(12);
			expect(series.reduce((s, p) => s + p.income, 0)).toBe(14_000_000);
			expect(series.find((p) => p.start === '2097-06-01')).toEqual({
				start: '2097-06-01',
				income: 4_000_000,
				expenses: 3_100_000
			});
		}));

	it('Laba Rugi: the months add up to the year, which equals the Dashboard for Tahunan', () =>
		inRollback(async (tx) => {
			await seed(tx);
			const { months, total } = await yearReport(tx, 2097);
			const sum = (k: 'income' | 'direct' | 'overhead' | 'profit') =>
				months.reduce((s, m) => s + m[k], 0);
			expect({
				income: sum('income'),
				direct: sum('direct'),
				overhead: sum('overhead'),
				profit: sum('profit')
			}).toEqual({
				income: total.income,
				direct: total.direct,
				overhead: total.overhead,
				profit: total.profit
			});
			const year = resolvePeriod({ period: 'year', from: '2097-05-05' }, { today: '2097-12-31' });
			expect(await periodTotals(tx, year.from, year.to)).toEqual(total);
			expect(total).toMatchObject({ income: 14_000_000, expenses: 3_500_000, profit: 10_500_000 });
			expect(months[5]).toMatchObject({ month: '2097-06', direct: 2_500_000, overhead: 600_000 });
		}));
});
