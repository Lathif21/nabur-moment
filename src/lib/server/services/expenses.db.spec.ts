// DB spec for expenses (P3-05). Neon `dev` branch (NEON_BRANCH=dev) or localhost only; every case
// runs in a transaction that is rolled back.
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { expenseSchema, paymentSchema } from '../../schemas/finance';
import { createDb, type Tx } from '../db/client';
import { activity } from '../db/schema/index';
import { createBooking } from './bookings';
import { ServiceError } from './errors';
import {
	bookingProfit,
	createExpense,
	deleteExpense,
	deleteExpenseCategory,
	listBookingExpenses,
	listExpenseCategories,
	listExpenses,
	saveExpenseCategory,
	setExpenseCategoryArchived,
	updateExpense
} from './expenses';
import { listSchedule } from './installments';
import { recordPayment } from './payments';
import { eq } from 'drizzle-orm';

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

const MONTH = '2033-03';

const exp = (categoryId: string, amount: number, bookingId: string | null, day = '2033-03-10') =>
	expenseSchema.parse({
		spentOn: day,
		amount: String(amount),
		categoryId,
		bookingId: bookingId ?? '',
		description: 'E2E CRM Spec Expense',
		method: 'cash'
	});

async function rejects(p: Promise<unknown>, text: RegExp) {
	const e = await p.then(
		() => null,
		(err: unknown) => err
	);
	expect(e).toBeInstanceOf(ServiceError);
	expect((e as ServiceError).message).toMatch(text);
}

describe.runIf(isDevDb)('expenses', () => {
	it('booking profit = its payments − its expenses; overhead rows have no booking', () =>
		inRollback(async (tx) => {
			const made = await createBooking(
				tx,
				bookingSchema.parse({
					newClientName: 'E2E CRM Spec Expense',
					newClientPhone: '0899-7008-0001',
					title: 'E2E CRM Expense',
					eventType: 'wedding',
					agreedPrice: '10000000',
					sessions: JSON.stringify([{ eventType: 'akad', date: '2033-03-20' }]),
					addons: '[]'
				}),
				null
			);
			const [dp] = await listSchedule(tx, made.id);
			await recordPayment(
				tx,
				paymentSchema.parse({
					bookingId: made.id,
					target: `inst:${dp.id}`,
					paidOn: '2033-03-01',
					amount: '5000000',
					method: 'transfer'
				}),
				null
			);
			const [crew, ads] = await listExpenseCategories(tx);
			await createExpense(tx, exp(crew.id, 1_500_000, made.id), null);
			const second = await createExpense(tx, exp(crew.id, 250_000, made.id), null);
			const overhead = await createExpense(tx, exp(ads.id, 700_000, null), null);

			expect(await bookingProfit(tx, made.id)).toEqual({
				paid: 5_000_000,
				costs: 1_750_000,
				profit: 3_250_000
			});
			expect(await listBookingExpenses(tx, made.id)).toHaveLength(2);

			const over = await listExpenses(tx, { scope: 'overhead', month: MONTH });
			expect(over.rows.some((r) => r.id === overhead.id)).toBe(true);
			expect(over.rows.every((r) => r.bookingId === null)).toBe(true);
			const direct = await listExpenses(tx, { scope: 'booking', month: MONTH });
			expect(direct.rows.every((r) => r.bookingId !== null)).toBe(true);
			expect(direct.rows.some((r) => r.id === overhead.id)).toBe(false);

			// Moving a cost to overhead takes it out of the booking's profit
			await updateExpense(tx, second.id, exp(crew.id, 250_000, null));
			expect((await bookingProfit(tx, made.id)).costs).toBe(1_500_000);
			await deleteExpense(tx, overhead.id, null);
			expect((await listExpenses(tx, { scope: 'overhead', month: MONTH })).rows).toHaveLength(1);

			// Direct costs show on the booking's timeline
			const logged = await tx
				.select({ body: activity.body })
				.from(activity)
				.where(eq(activity.bookingId, made.id));
			expect(logged.some((a) => a.body?.startsWith('Biaya Rp'))).toBe(true);
		}));

	it('categories: unique names, archived ones refused for new expenses, delete only when unused', () =>
		inRollback(async (tx) => {
			const cat = await saveExpenseCategory(tx, { id: null, name: 'E2E Sewa lighting' });
			await rejects(saveExpenseCategory(tx, { id: null, name: 'e2e sewa LIGHTING' }), /sudah ada/);
			const e = await createExpense(tx, exp(cat.id, 100_000, null), null);
			await rejects(deleteExpenseCategory(tx, cat.id), /Arsipkan saja/);

			await setExpenseCategoryArchived(tx, cat.id, true);
			await rejects(createExpense(tx, exp(cat.id, 1, null), null), /kategori yang aktif/);
			// The expense that already uses it can still be edited
			await updateExpense(tx, e.id, exp(cat.id, 120_000, null));
			expect((await listExpenseCategories(tx)).some((c) => c.id === cat.id)).toBe(false);

			await deleteExpense(tx, e.id, null);
			await deleteExpenseCategory(tx, cat.id);
			expect(
				(await listExpenseCategories(tx, { withArchived: true })).some((c) => c.id === cat.id)
			).toBe(false);
		}));
});
