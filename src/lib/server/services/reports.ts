// Reports (P3-06 Dashboard, P3-07 Laba Rugi; 02-DATA-MODEL "Profit"): income = payments by
// `paid_on`, expenses by `spent_on`, both whole Rupiah, no tax. The Dashboard and Laba Rugi read
// the same `periodTotals`, so their numbers always agree. Every function takes `db` first.
import {
	and,
	asc,
	between,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	sql
} from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { booking, bookingSession, client, expense, invoice, payment } from '../db/schema/index.ts';
import { STAGES, type Stage } from '../../crm.ts';
import { addDays, bucketStarts, type Bucket } from '../../period.ts';

const sumOf = (col: typeof payment.amount | typeof expense.amount) =>
	sql<number>`coalesce(sum(${col}), 0)::bigint`.mapWith(Number);

export type Totals = {
	income: number;
	/** expenses with a booking */
	direct: number;
	/** expenses without a booking */
	overhead: number;
	expenses: number;
	profit: number;
};

/** Money in and out for the days [from, to] (inclusive) */
export async function periodTotals(db: DbOrTx, from: string, to: string): Promise<Totals> {
	const [[{ income }], [{ direct }], [{ overhead }]] = await Promise.all([
		db
			.select({ income: sumOf(payment.amount) })
			.from(payment)
			.where(between(payment.paidOn, from, to)),
		db
			.select({ direct: sumOf(expense.amount) })
			.from(expense)
			.where(and(between(expense.spentOn, from, to), isNotNull(expense.bookingId))),
		db
			.select({ overhead: sumOf(expense.amount) })
			.from(expense)
			.where(and(between(expense.spentOn, from, to), isNull(expense.bookingId)))
	]);
	const expenses = direct + overhead;
	return { income, direct, overhead, expenses, profit: income - expenses };
}

/**
 * Piutang on a day: what open bookings (not Batal) made by then still owe, after the payments
 * received by then. Today's value when `asOf` is today.
 */
export async function receivables(db: DbOrTx, asOf: string): Promise<number> {
	const [row] = await db
		.select({
			total:
				sql<number>`coalesce(sum(greatest(${booking.agreedPrice} - (select coalesce(sum(p.amount), 0) from "payment" p where p.booking_id = "booking"."id" and p.paid_on <= ${asOf}::date), 0)), 0)::bigint`.mapWith(
					Number
				)
		})
		.from(booking)
		.where(
			and(
				ne(booking.stage, 'lost'),
				sql`(${booking.createdAt} at time zone 'Asia/Jakarta')::date <= ${asOf}::date`
			)
		);
	return row.total;
}

/** Income and expenses per chart bucket (date_trunc weeks start Monday, like period.ts) */
export async function moneySeries(db: DbOrTx, from: string, to: string, bucket: Bucket) {
	const trunc = (col: typeof payment.paidOn | typeof expense.spentOn) =>
		sql<string>`to_char(date_trunc(${bucket}, ${col}), 'YYYY-MM-DD')`;
	const [inc, exp] = await Promise.all([
		db
			.select({ start: trunc(payment.paidOn), total: sumOf(payment.amount) })
			.from(payment)
			.where(between(payment.paidOn, from, to))
			.groupBy(sql`1`),
		db
			.select({ start: trunc(expense.spentOn), total: sumOf(expense.amount) })
			.from(expense)
			.where(between(expense.spentOn, from, to))
			.groupBy(sql`1`)
	]);
	const i = new Map(inc.map((r) => [r.start, r.total]));
	const e = new Map(exp.map((r) => [r.start, r.total]));
	return bucketStarts(from, to, bucket).map((start) => ({
		start,
		income: i.get(start) ?? 0,
		expenses: e.get(start) ?? 0
	}));
}

export type SeriesPoint = Awaited<ReturnType<typeof moneySeries>>[number];

/** Sessions in the next `days` days (Batal excluded), soonest first */
export async function upcomingSessions(db: DbOrTx, today: string, days = 30) {
	return db
		.select({
			id: bookingSession.id,
			date: bookingSession.date,
			startTime: bookingSession.startTime,
			eventType: bookingSession.eventType,
			bookingId: booking.id,
			title: booking.title,
			stage: booking.stage,
			bookedAt: booking.bookedAt,
			clientName: client.name
		})
		.from(bookingSession)
		.innerJoin(booking, eq(booking.id, bookingSession.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(
			and(
				gte(bookingSession.date, today),
				lte(bookingSession.date, addDays(today, days)),
				ne(booking.stage, 'lost')
			)
		)
		.orderBy(asc(bookingSession.date), asc(bookingSession.startTime))
		.limit(20);
}

/** Overdue invoices, then the ones due within a week, with what is still open */
export async function invoicesNeedingAttention(db: DbOrTx, today: string) {
	return db
		.select({
			id: invoice.id,
			number: invoice.number,
			status: invoice.status,
			dueDate: invoice.dueDate,
			total: invoice.total,
			paid: sql<number>`(select coalesce(sum(p.amount), 0) from "payment" p where p.invoice_id = "invoice"."id")::bigint`.mapWith(
				Number
			),
			bookingTitle: booking.title,
			clientName: client.name
		})
		.from(invoice)
		.innerJoin(booking, eq(booking.id, invoice.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(
			and(
				inArray(invoice.status, ['sent', 'partial', 'overdue']),
				lte(invoice.dueDate, addDays(today, 7))
			)
		)
		.orderBy(asc(invoice.dueDate))
		.limit(10);
}

/** Bookings per stage (the pipeline summary), in board order */
export async function pipelineCounts(db: DbOrTx) {
	const rows = await db
		.select({ stage: booking.stage, n: sql<number>`count(*)::int` })
		.from(booking)
		.groupBy(booking.stage);
	const by = new Map(rows.map((r) => [r.stage, r.n]));
	return STAGES.map((s) => ({ stage: s.key as Stage, label: s.label, n: by.get(s.key) ?? 0 }));
}

/** Newest bookings still in Inquiry (website form and manual) */
export async function newInquiries(db: DbOrTx, limit = 5) {
	return db
		.select({
			id: booking.id,
			title: booking.title,
			origin: booking.origin,
			createdAt: booking.createdAt,
			clientName: client.name
		})
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(eq(booking.stage, 'inquiry'))
		.orderBy(desc(booking.createdAt))
		.limit(limit);
}

/**
 * Laba Rugi (P3-07): the twelve months of a year (two grouped queries) and the year total from
 * `periodTotals`, the same call the Dashboard makes for Tahunan.
 */
export async function yearReport(db: DbOrTx, year: number) {
	const from = `${year}-01-01`;
	const to = `${year}-12-31`;
	const month = (col: typeof payment.paidOn | typeof expense.spentOn) =>
		sql<string>`to_char(${col}, 'YYYY-MM')`;
	const [inc, exp, total] = await Promise.all([
		db
			.select({ month: month(payment.paidOn), income: sumOf(payment.amount) })
			.from(payment)
			.where(between(payment.paidOn, from, to))
			.groupBy(sql`1`),
		db
			.select({
				month: month(expense.spentOn),
				direct:
					sql<number>`coalesce(sum(${expense.amount}) filter (where ${expense.bookingId} is not null), 0)::bigint`.mapWith(
						Number
					),
				overhead:
					sql<number>`coalesce(sum(${expense.amount}) filter (where ${expense.bookingId} is null), 0)::bigint`.mapWith(
						Number
					)
			})
			.from(expense)
			.where(between(expense.spentOn, from, to))
			.groupBy(sql`1`),
		periodTotals(db, from, to)
	]);
	const i = new Map(inc.map((r) => [r.month, r.income]));
	const e = new Map(exp.map((r) => [r.month, r]));
	const months: (Totals & { month: string })[] = Array.from({ length: 12 }, (_, k) => {
		const key = `${year}-${String(k + 1).padStart(2, '0')}`;
		const income = i.get(key) ?? 0;
		const direct = e.get(key)?.direct ?? 0;
		const overhead = e.get(key)?.overhead ?? 0;
		const expenses = direct + overhead;
		return { month: key, income, direct, overhead, expenses, profit: income - expenses };
	});
	return { months, total };
}
