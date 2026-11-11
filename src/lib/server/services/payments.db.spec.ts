// DB spec for payments (P3-04). Neon `dev` branch (NEON_BRANCH=dev) or localhost only; every case
// runs in a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { paymentSchema } from '../../schemas/finance';
import { createDb, type Tx } from '../db/client';
import { booking, invoice, media } from '../db/schema/index';
import { createBooking, moveBooking } from './bookings';
import { listCalendar } from './calendar';
import { ServiceError } from './errors';
import { listSchedule } from './installments';
import { createInstallmentInvoice } from './invoices';
import { deletePayment, listBookingPayments, paymentTargets, recordPayment } from './payments';

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

const DAY = '2033-07-07';

const newBooking = (tx: Tx, phone: string) =>
	createBooking(
		tx,
		bookingSchema.parse({
			newClientName: 'E2E CRM Spec Payment',
			newClientPhone: phone,
			title: 'E2E CRM Payment',
			eventType: 'wedding',
			agreedPrice: '10000000',
			sessions: JSON.stringify([{ eventType: 'akad', date: DAY }]),
			addons: '[]',
			stage: 'quotation'
		}),
		null
	);

const pay = (bookingId: string, target: string, amount: number, paidOn = '2033-06-01') =>
	paymentSchema.parse({
		bookingId,
		target,
		paidOn,
		amount: String(amount),
		method: 'transfer'
	});

const move = (id: string, to: string, extra: Record<string, unknown> = {}) => ({
	id,
	to: to as never,
	beforeId: null,
	afterId: null,
	lostReason: null,
	confirmBalance: false,
	...extra
});

async function rejects(p: Promise<unknown>, text: RegExp) {
	const e = await p.then(
		() => null,
		(err: unknown) => err
	);
	expect(e).toBeInstanceOf(ServiceError);
	expect((e as ServiceError).message).toMatch(text);
}

const status = async (tx: Tx, id: string) =>
	(await tx.select({ s: invoice.status }).from(invoice).where(eq(invoice.id, id)))[0].s;
const bookedAt = async (tx: Tx, id: string) =>
	(await tx.select({ b: booking.bookedAt }).from(booking).where(eq(booking.id, id)))[0].b;

describe.runIf(isDevDb)('payments', () => {
	it('partial → paid DP invoice; the paid DP sets booked_at, allows Booked and makes the calendar solid', () =>
		inRollback(async (tx) => {
			const made = await newBooking(tx, '0899-7007-0001');
			const [dp] = await listSchedule(tx, made.id);
			const inv = await createInstallmentInvoice(
				tx,
				{ installmentId: dp.id, issueDate: '2033-06-01', dueDate: '2099-06-08', notes: null },
				null
			);

			const first = await recordPayment(tx, pay(made.id, `inv:${inv.id}`, 2_000_000), null);
			expect(first.receiptNumber).toMatch(/^KW\/NM\/2033\/06\/\d{3,}$/);
			expect(first.dpPaidNow).toBe(false);
			expect(await status(tx, inv.id)).toBe('partial');
			expect(await bookedAt(tx, made.id)).toBeNull();
			await rejects(moveBooking(tx, move(made.id, 'booked'), null), /DP belum lunas/);
			// More than what is open is refused
			await rejects(
				recordPayment(tx, pay(made.id, `inv:${inv.id}`, 3_000_001), null),
				/melebihi sisa tagihan/
			);

			const second = await recordPayment(tx, pay(made.id, `inv:${inv.id}`, 3_000_000), null);
			expect(second.dpPaidNow).toBe(true);
			expect(await status(tx, inv.id)).toBe('paid');
			expect(await bookedAt(tx, made.id)).not.toBeNull();
			const [dpAfter] = await listSchedule(tx, made.id);
			expect(dpAfter.paid).toBe(5_000_000);

			await moveBooking(tx, move(made.id, 'booked'), null);
			const cal = await listCalendar(tx, { from: DAY, to: DAY });
			expect(cal.items.find((i) => i.bookingId === made.id)?.booked).toBe(true);
		}));

	it(
		'paying an installment without an invoice creates its invoice; Selesai needs no confirmation once fully paid',
		() =>
			inRollback(async (tx) => {
				const made = await newBooking(tx, '0899-7007-0002');
				const [dp, pelunasan] = await listSchedule(tx, made.id);
				expect((await paymentTargets(tx, made.id)).map((t) => t.value)).toEqual([
					`inst:${dp.id}`,
					`inst:${pelunasan.id}`
				]);
				// Every payment has an invoice: a part of the DP creates the DP invoice for what is open
				const first = await recordPayment(tx, pay(made.id, `inst:${dp.id}`, 2_000_000), null);
				expect(first.invoiceId).not.toBeNull();
				const [inv] = await tx.select().from(invoice).where(eq(invoice.id, first.invoiceId!));
				expect(inv).toMatchObject({
					installmentId: dp.id,
					total: 5_000_000,
					issueDate: '2033-06-01',
					dueDate: '2033-06-08',
					status: 'partial'
				});
				expect(inv.number).toMatch(/^INV\/NM\/2033\/06\/\d{3,}$/);
				// The rest of the DP goes onto that same invoice
				const second = await recordPayment(tx, pay(made.id, `inst:${dp.id}`, 3_000_000), null);
				expect(second.invoiceId).toBe(inv.id);
				expect(await status(tx, inv.id)).toBe('paid');
				await moveBooking(tx, move(made.id, 'booked'), null);
				// Balance left: Selesai asks for confirmation
				await rejects(moveBooking(tx, move(made.id, 'completed'), null), /sisa tagihan/);
				const last = await recordPayment(tx, pay(made.id, `inst:${pelunasan.id}`, 5_000_000), null);
				// Pelunasan invoice: due on Hari H
				const [pInv] = await tx.select().from(invoice).where(eq(invoice.id, last.invoiceId!));
				expect(pInv).toMatchObject({ installmentId: pelunasan.id, dueDate: DAY, status: 'paid' });
				await moveBooking(tx, move(made.id, 'completed'), null);
				expect(await paymentTargets(tx, made.id)).toEqual([]);
				await rejects(
					recordPayment(tx, pay(made.id, `inst:${pelunasan.id}`, 1), null),
					/sudah lunas/
				);
			}),
		30_000
	); // four payments, two invoices over the network

	it('deleting the DP payment is refused once Booked; before that it clears booked_at and the status', () =>
		inRollback(async (tx) => {
			const made = await newBooking(tx, '0899-7007-0003');
			const [dp] = await listSchedule(tx, made.id);
			const inv = await createInstallmentInvoice(
				tx,
				{ installmentId: dp.id, issueDate: '2033-06-01', dueDate: '2099-06-08', notes: null },
				null
			);
			// Paying the installment goes through its invoice
			const p = await recordPayment(tx, pay(made.id, `inst:${dp.id}`, 5_000_000), null);
			expect(p.invoiceId).toBe(inv.id);
			expect(await status(tx, inv.id)).toBe('paid');

			await moveBooking(tx, move(made.id, 'booked'), null);
			await rejects(deletePayment(tx, p.id, null), /Pindahkan dulu ke Penawaran/);

			await moveBooking(tx, move(made.id, 'quotation'), null);
			await deletePayment(tx, p.id, null);
			expect(await bookedAt(tx, made.id)).toBeNull();
			expect(await status(tx, inv.id)).toBe('draft');
			expect(await listBookingPayments(tx, made.id)).toEqual([]);
		}));

	it('refuses a proof that is not a private, finished upload; refuses payments on Batal', () =>
		inRollback(async (tx) => {
			const made = await newBooking(tx, '0899-7007-0004');
			const [dp] = await listSchedule(tx, made.id);
			const [pub] = await tx
				.insert(media)
				.values({ kind: 'image', bucket: 'site-media', key: 'x/y.webp', status: 'ready' })
				.returning();
			await rejects(
				recordPayment(
					tx,
					{ ...pay(made.id, `inst:${dp.id}`, 1_000_000), proofMediaId: pub.id },
					null
				),
				/Bukti pembayaran/
			);
			await moveBooking(tx, move(made.id, 'lost', { lostReason: 'Uji' }), null);
			await rejects(recordPayment(tx, pay(made.id, `inst:${dp.id}`, 1_000_000), null), /batal/);
		}));
});
