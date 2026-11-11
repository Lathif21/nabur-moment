// Crew (client feedback 11 Nov 2026): the people who work an event. An asset, not a user. A
// booking has 0, 1 or 2 crew; the Kru page counts the bookings each one handles (booked onward,
// never Batal) by Hari H. Every function takes `db` or an open transaction first.
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { booking, bookingCrew, bookingSession, client, crew } from '../db/schema/index.ts';
import { BOOKED_STAGES, type EventType, type Stage } from '../../crm.ts';
import { ServiceError } from './errors.ts';

/** One event is handled by 1 or 2 crew */
export const MAX_CREW_PER_BOOKING = 2;

export type CrewInput = {
	name: string;
	role: string;
	phone: string | null;
	/** Omitted = '' on create, unchanged on update */
	city?: string;
	device?: string;
	active: boolean;
};

/** Earliest dated session = Hari H (columns written out: Drizzle leaves them unqualified) */
const hariHSql = sql<
	string | null
>`(select min(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id")`;

/** Bookings a crew member "handles": booked onward (DP paid), never Batal, Hari H in the range */
const handled = (from: string, to: string) =>
	and(
		inArray(booking.stage, [...BOOKED_STAGES]),
		// compared as a date (hariHSql is text for the UI)
		sql`(select min(bs.date) from "booking_session" bs where bs.booking_id = "booking"."id") between ${from}::date and ${to}::date`
	);

/** Kru page: every crew member with how many bookings they handle in the period */
export async function listCrew(db: DbOrTx, period: { from: string; to: string }) {
	const counts = db
		.select({ crewId: bookingCrew.crewId, n: count().as('n') })
		.from(bookingCrew)
		.innerJoin(booking, eq(booking.id, bookingCrew.bookingId))
		.where(handled(period.from, period.to))
		.groupBy(bookingCrew.crewId)
		.as('counts');
	return db
		.select({
			id: crew.id,
			name: crew.name,
			role: crew.role,
			phone: crew.phone,
			city: crew.city,
			device: crew.device,
			active: crew.active,
			bookings: sql<number>`coalesce(${counts.n}, 0)::int`,
			/** All-time assignments (any stage): delete is refused when > 0 */
			assigned: sql<number>`(select count(*)::int from "booking_crew" bc where bc.crew_id = "crew"."id")`
		})
		.from(crew)
		.leftJoin(counts, eq(counts.crewId, crew.id))
		.orderBy(sql`${crew.active} desc`, asc(crew.name));
}

export type CrewRow = Awaited<ReturnType<typeof listCrew>>[number];

export async function getCrew(db: DbOrTx, id: string) {
	const [row] = await db.select().from(crew).where(eq(crew.id, id));
	return row ?? null;
}

/** Crew detail: the bookings they handle in the period, by Hari H, with each session */
export async function crewJobs(db: DbOrTx, crewId: string, period: { from: string; to: string }) {
	const rows = await db
		.select({
			id: booking.id,
			title: booking.title,
			stage: booking.stage,
			clientId: client.id,
			clientName: client.name,
			hariH: hariHSql
		})
		.from(bookingCrew)
		.innerJoin(booking, eq(booking.id, bookingCrew.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(and(eq(bookingCrew.crewId, crewId), handled(period.from, period.to)))
		// yyyy-MM-dd text sorts like the date
		.orderBy(sql`${hariHSql} asc`, asc(booking.title));
	if (!rows.length) return [];
	const sessions = await db
		.select({
			bookingId: bookingSession.bookingId,
			eventType: bookingSession.eventType,
			date: bookingSession.date,
			startTime: bookingSession.startTime,
			venue: bookingSession.venue,
			city: bookingSession.city
		})
		.from(bookingSession)
		.where(
			inArray(
				bookingSession.bookingId,
				rows.map((r) => r.id)
			)
		)
		.orderBy(sql`${bookingSession.date} asc nulls last`, asc(bookingSession.sort));
	return rows.map((r) => ({
		...r,
		stage: r.stage as Stage,
		sessions: sessions
			.filter((s) => s.bookingId === r.id)
			.map((s) => ({ ...s, eventType: s.eventType as EventType }))
	}));
}

export async function createCrew(db: DbOrTx, input: CrewInput) {
	const [row] = await db.insert(crew).values(input).returning();
	return row;
}

export async function updateCrew(db: DbOrTx, id: string, input: CrewInput) {
	const [row] = await db.update(crew).set(input).where(eq(crew.id, id)).returning();
	if (!row) throw new ServiceError('Kru tidak ditemukan.');
	return row;
}

/** Only crew that never worked a booking; others are deactivated so their history stays */
export async function deleteCrew(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		const [{ n }] = await tx
			.select({ n: count() })
			.from(bookingCrew)
			.where(eq(bookingCrew.crewId, id));
		if (n > 0)
			throw new ServiceError(
				`Kru ini tercatat di ${n} booking. Nonaktifkan saja agar riwayatnya tetap ada.`
			);
		const done = await tx.delete(crew).where(eq(crew.id, id)).returning({ id: crew.id });
		if (!done.length) throw new ServiceError('Kru tidak ditemukan.');
	});
}

/** Active crew for the booking form's picker (plus inactive ones already on that booking) */
export async function crewOptions(db: DbOrTx) {
	return db
		.select({ id: crew.id, name: crew.name, role: crew.role, active: crew.active })
		.from(crew)
		.orderBy(sql`${crew.active} desc`, asc(crew.name));
}

/**
 * Replace a booking's crew (inside the booking's save transaction). At most two, no repeats;
 * a newly added member must be active, one already on the booking may stay after deactivation.
 */
export async function setBookingCrew(tx: DbOrTx, bookingId: string, crewIds: string[]) {
	const ids = [...new Set(crewIds)];
	if (ids.length !== crewIds.length)
		throw new ServiceError('Kru yang sama dipilih dua kali.', 'crewIds');
	if (ids.length > MAX_CREW_PER_BOOKING)
		throw new ServiceError(`Maksimal ${MAX_CREW_PER_BOOKING} kru per booking.`, 'crewIds');
	const before = await tx
		.select({ crewId: bookingCrew.crewId })
		.from(bookingCrew)
		.where(eq(bookingCrew.bookingId, bookingId));
	if (ids.length) {
		const found = await tx
			.select({ id: crew.id, active: crew.active })
			.from(crew)
			.where(inArray(crew.id, ids));
		if (found.length !== ids.length) throw new ServiceError('Kru tidak ditemukan.', 'crewIds');
		const kept = new Set(before.map((b) => b.crewId));
		if (found.some((c) => !c.active && !kept.has(c.id)))
			throw new ServiceError('Kru nonaktif tidak bisa ditambahkan.', 'crewIds');
	}
	await tx.delete(bookingCrew).where(eq(bookingCrew.bookingId, bookingId));
	if (ids.length) await tx.insert(bookingCrew).values(ids.map((crewId) => ({ bookingId, crewId })));
}

/** Crew per booking, in name order: board cards, the booking page, the calendar */
export async function crewByBooking(db: DbOrTx, bookingIds: string[]) {
	const out: Record<string, { id: string; name: string }[]> = {};
	if (!bookingIds.length) return out;
	const rows = await db
		.select({ bookingId: bookingCrew.bookingId, id: crew.id, name: crew.name })
		.from(bookingCrew)
		.innerJoin(crew, eq(crew.id, bookingCrew.crewId))
		.where(inArray(bookingCrew.bookingId, [...new Set(bookingIds)]))
		.orderBy(asc(crew.name));
	for (const r of rows) (out[r.bookingId] ??= []).push({ id: r.id, name: r.name });
	return out;
}
