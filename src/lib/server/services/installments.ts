// Payment schedule (P3-01, 01-PRD "Payment schedule", 02-DATA-MODEL booking_installment):
// DP = DP_PERCENT of the agreed price, no due date; Pelunasan = the rest, due on Hari H (the first
// session date). Every function takes `db` or an open transaction first.
import { asc, eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { booking, bookingInstallment } from '../db/schema/index.ts';
import { splitPrice } from '../../finance.ts';
import { rupiah } from '../../format.ts';
import { ServiceError } from './errors.ts';

/**
 * Create or bring the schedule in line with the booking. Run it in the same transaction as every
 * change to the agreed price, add-ons, sessions or stage.
 * - The DP is recalculated only while unpaid. Paid = `booked_at` set (P3-04 sets it from the DP
 *   payment); after that a price change goes to the pelunasan only.
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
	const dp = rows.find((r) => r.kind === 'dp');
	const pelunasan = rows.find((r) => r.kind === 'pelunasan');
	const others = rows.filter((r) => r.kind === 'other').reduce((s, r) => s + r.amount, 0);

	const dpPaid = b.bookedAt !== null;
	const dpAmount = dp && dpPaid ? dp.amount : splitPrice(b.agreedPrice).dp;
	const pelunasanAmount = b.agreedPrice - dpAmount - others;
	if (pelunasanAmount < 0)
		throw new ServiceError(
			`Harga disepakati tidak boleh di bawah DP yang sudah dibayar (${rupiah(dpAmount)}).`,
			'agreedPrice'
		);
	const cancelledAt = b.stage === 'lost' ? (pelunasan?.cancelledAt ?? new Date()) : null;

	if (!dp)
		await db
			.insert(bookingInstallment)
			.values({ bookingId, kind: 'dp', amount: dpAmount, dueDate: null, sort: 0 });
	else if (dp.amount !== dpAmount)
		await db
			.update(bookingInstallment)
			.set({ amount: dpAmount })
			.where(eq(bookingInstallment.id, dp.id));

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

/** The schedule for the booking page, DP first */
export async function listSchedule(db: DbOrTx, bookingId: string) {
	return db
		.select({
			id: bookingInstallment.id,
			kind: bookingInstallment.kind,
			amount: bookingInstallment.amount,
			dueDate: bookingInstallment.dueDate,
			cancelledAt: bookingInstallment.cancelledAt
		})
		.from(bookingInstallment)
		.where(eq(bookingInstallment.bookingId, bookingId))
		.orderBy(asc(bookingInstallment.sort), asc(bookingInstallment.createdAt));
}

export type ScheduleRow = Awaited<ReturnType<typeof listSchedule>>[number];
