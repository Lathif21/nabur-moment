// Payment schedule (P3-01, 01-PRD "Payment schedule", 02-DATA-MODEL booking_installment):
// DP = DP_PERCENT of the agreed price (or the whole price: "Lunas sekaligus"), no due date;
// Pelunasan = the rest, due on Hari H (the first session date). Every function takes `db` or an
// open transaction first.
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { booking, bookingInstallment, invoice, payment } from '../db/schema/index.ts';
import { isFirstInstallment, splitPrice } from '../../finance.ts';
import { rupiah } from '../../format.ts';
import { ServiceError } from './errors.ts';

/**
 * Create or bring the schedule in line with the booking. Run it in the same transaction as every
 * change to the agreed price, add-ons, sessions or stage.
 * - The first installment is the DP (DP_PERCENT of the price) or, when the client pays at once,
 *   `full` (the whole price). It follows the price only while unpaid. Paid = `booked_at` set (set
 *   from the payments); after that a price change (an add-on) goes to the pelunasan only.
 * - The pelunasan due date follows the first session date.
 * - Batal cancels the pelunasan (a paid DP stays as income); leaving Batal restores it.
 */
export async function ensureSchedule(db: DbOrTx, bookingId: string) {
	const [b] = await db
		.select({
			agreedPrice: booking.agreedPrice,
			stage: booking.stage,
			bookedAt: booking.bookedAt,
			// Columns written out: Drizzle leaves ${booking.id} unqualified in a single-table select
			firstDate: sql<
				string | null
			>`(select min(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id")`
		})
		.from(booking)
		.where(eq(booking.id, bookingId));
	if (!b) throw new ServiceError('Booking tidak ditemukan.');

	const rows = await db
		.select()
		.from(bookingInstallment)
		.where(eq(bookingInstallment.bookingId, bookingId))
		.for('update');
	const first = rows.find((r) => isFirstInstallment(r.kind));
	const pelunasan = rows.find((r) => r.kind === 'pelunasan');
	const others = rows.filter((r) => r.kind === 'other').reduce((s, r) => s + r.amount, 0);

	const paidFirst = b.bookedAt !== null;
	const full = first?.kind === 'full';
	const firstAmount =
		first && paidFirst
			? first.amount
			: full
				? Math.max(0, b.agreedPrice - others)
				: splitPrice(b.agreedPrice).dp;
	const pelunasanAmount = b.agreedPrice - firstAmount - others;
	if (pelunasanAmount < 0)
		throw new ServiceError(
			`Harga disepakati tidak boleh di bawah ${full ? 'pembayaran lunas' : 'DP'} yang sudah dibayar (${rupiah(firstAmount)}).`,
			'agreedPrice'
		);
	const cancelledAt = b.stage === 'lost' ? (pelunasan?.cancelledAt ?? new Date()) : null;

	if (!first)
		await db
			.insert(bookingInstallment)
			.values({ bookingId, kind: 'dp', amount: firstAmount, dueDate: null, sort: 0 });
	else if (first.amount !== firstAmount)
		await db
			.update(bookingInstallment)
			.set({ amount: firstAmount })
			.where(eq(bookingInstallment.id, first.id));

	if (!pelunasan)
		await db.insert(bookingInstallment).values({
			bookingId,
			kind: 'pelunasan',
			amount: pelunasanAmount,
			dueDate: b.firstDate,
			cancelledAt,
			sort: 1
		});
	else if (
		pelunasan.amount !== pelunasanAmount ||
		pelunasan.dueDate !== b.firstDate ||
		+(pelunasan.cancelledAt ?? 0) !== +(cancelledAt ?? 0)
	)
		await db
			.update(bookingInstallment)
			.set({ amount: pelunasanAmount, dueDate: b.firstDate, cancelledAt })
			.where(eq(bookingInstallment.id, pelunasan.id));
}

/**
 * Switch the first installment between the DP (`dp`) and "Lunas sekaligus" (`full`), then bring
 * the schedule in line. Only while nothing is paid or billed on the DP / full and the pelunasan.
 * Runs inside the caller's transaction.
 */
export async function setFirstInstallmentKind(tx: DbOrTx, bookingId: string, kind: 'dp' | 'full') {
	const rows = await tx
		.select({ id: bookingInstallment.id, kind: bookingInstallment.kind })
		.from(bookingInstallment)
		.where(eq(bookingInstallment.bookingId, bookingId))
		.for('update');
	const first = rows.find((r) => isFirstInstallment(r.kind));
	if (!first) throw new ServiceError('Jadwal pembayaran tidak ditemukan.');
	if (first.kind === kind) return;
	const ids = rows.filter((r) => r.kind !== 'other').map((r) => r.id);
	const [{ paid }] = await tx
		.select({ paid: sql<number>`coalesce(sum(${payment.amount}), 0)::bigint`.mapWith(Number) })
		.from(payment)
		.where(inArray(payment.installmentId, ids));
	if (paid > 0)
		throw new ServiceError(
			'Sudah ada pembayaran di jadwal ini, jadi DP / lunas sekaligus tidak bisa diganti lagi.'
		);
	const [billed] = await tx
		.select({ number: invoice.number })
		.from(invoice)
		.where(and(inArray(invoice.installmentId, ids), ne(invoice.status, 'void')))
		.limit(1);
	if (billed)
		throw new ServiceError(
			`Jadwal ini sudah punya invoice ${billed.number}. Batalkan dulu invoice itu untuk mengganti DP / lunas sekaligus.`
		);
	await tx.update(bookingInstallment).set({ kind }).where(eq(bookingInstallment.id, first.id));
	await ensureSchedule(tx, bookingId);
}

/**
 * Part of an installment not covered by an active invoice (nor by an old payment without one): the
 * amount grew after its invoice, e.g. an add-on after the pelunasan was billed. Never below 0.
 */
export const unbilledSql = sql<number>`greatest(0, "booking_installment"."amount"
	- (select coalesce(sum(i.total), 0) from "invoice" i where i.installment_id = "booking_installment"."id" and i.status <> 'void')
	- (select coalesce(sum(p.amount), 0) from "payment" p where p.installment_id = "booking_installment"."id" and p.invoice_id is null))::bigint`;

/** The schedule for the booking page, DP first, with what was paid on each */
export async function listSchedule(db: DbOrTx, bookingId: string) {
	return db
		.select({
			id: bookingInstallment.id,
			kind: bookingInstallment.kind,
			amount: bookingInstallment.amount,
			dueDate: bookingInstallment.dueDate,
			cancelledAt: bookingInstallment.cancelledAt,
			/** received on this installment (P3-04) */
			paid: sql<number>`(select coalesce(sum(p.amount), 0) from "payment" p where p.installment_id = "booking_installment"."id")::bigint`.mapWith(
				Number
			),
			/** not on any active invoice yet: what "Buat invoice" bills (an add-on after the invoice) */
			unbilled: unbilledSql.mapWith(Number)
		})
		.from(bookingInstallment)
		.where(eq(bookingInstallment.bookingId, bookingId))
		.orderBy(asc(bookingInstallment.sort), asc(bookingInstallment.createdAt));
}

export type ScheduleRow = Awaited<ReturnType<typeof listSchedule>>[number];
