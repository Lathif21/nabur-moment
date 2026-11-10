// Kalender (P2-05, 01-PRD "Calendar", 03-SCREENS B3): booking sessions by session date.
// Booked (DP paid) vs tentative (dated, no DP yet), coloured by crew count; Batal never shows. A day with sessions of 2+
// bookings gets a warning (allowed, never blocked). Takes `db` or an open transaction first.
import { and, asc, between, eq, ne, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { booking, bookingSession, client } from '../db/schema/index.ts';
import type { EventType } from '../../crm.ts';

export type CalendarFilter = {
	/** First and last day shown, `yyyy-MM-dd` */
	from: string;
	to: string;
	/** Session event type; null = all */
	eventType?: EventType | null;
	/** Show bookings without a paid DP (default true) */
	includeTentative?: boolean;
};

export async function listCalendar(db: DbOrTx, filter: CalendarFilter) {
	const rows = await db
		.select({
			id: bookingSession.id,
			date: bookingSession.date,
			startTime: bookingSession.startTime,
			endTime: bookingSession.endTime,
			eventType: bookingSession.eventType,
			venue: bookingSession.venue,
			city: bookingSession.city,
			bookingId: booking.id,
			title: booking.title,
			stage: booking.stage,
			bookedAt: booking.bookedAt,
			agreedPrice: booking.agreedPrice,
			clientName: client.name,
			/** Crew names; the count (0–2) colours the chip: 1 = emerald, 2 = burgundy */
			crew: sql<
				string[]
			>`(select coalesce(array_agg(c.name order by c.name), '{}') from "booking_crew" bc join "crew" c on c.id = bc.crew_id where bc.booking_id = "booking"."id")`
		})
		.from(bookingSession)
		.innerJoin(booking, eq(booking.id, bookingSession.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(and(between(bookingSession.date, filter.from, filter.to), ne(booking.stage, 'lost')))
		.orderBy(
			asc(bookingSession.date),
			asc(bookingSession.startTime),
			asc(booking.title),
			asc(bookingSession.sort)
		);

	const all = rows.map((r) => ({
		...r,
		date: r.date!,
		booked: r.bookedAt !== null,
		crewCount: r.crew.length
	}));

	// Warnings count every non-Batal booking on the day, whatever the filters hide
	const perDay = new Map<string, Set<string>>();
	for (const r of all) {
		const set = perDay.get(r.date) ?? new Set<string>();
		set.add(r.bookingId);
		perDay.set(r.date, set);
	}
	const busyDays: Record<string, number> = {};
	for (const [day, set] of perDay) if (set.size > 1) busyDays[day] = set.size;

	const includeTentative = filter.includeTentative ?? true;
	const items = all.filter(
		(r) => (includeTentative || r.booked) && (!filter.eventType || r.eventType === filter.eventType)
	);
	return { items, busyDays };
}

export type CalendarItem = Awaited<ReturnType<typeof listCalendar>>['items'][number];
