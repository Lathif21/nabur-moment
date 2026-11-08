// Activity timeline (P2-04, 01-PRD §6): notes, calls, WhatsApp, meetings typed by a person, plus
// the stage changes and system entries other services write. Newest first everywhere.
// Every function takes `db` or an open transaction first.
import { desc, eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { activity, booking, user } from '../db/schema/index.ts';
import type { ActivityInput } from '../../schemas/crm.ts';
import { ServiceError } from './errors.ts';

/** Timeline of one booking or one client (all of its bookings), newest first */
export async function listActivities(
	db: DbOrTx,
	of: { bookingId: string } | { clientId: string },
	limit = 200
) {
	return db
		.select({
			id: activity.id,
			type: activity.type,
			body: activity.body,
			meta: activity.meta,
			occurredAt: activity.occurredAt,
			bookingId: activity.bookingId,
			bookingTitle: booking.title,
			userName: user.name
		})
		.from(activity)
		.leftJoin(booking, eq(booking.id, activity.bookingId))
		.leftJoin(user, eq(user.id, activity.userId))
		.where(
			'bookingId' in of ? eq(activity.bookingId, of.bookingId) : eq(activity.clientId, of.clientId)
		)
		.orderBy(desc(activity.occurredAt), desc(activity.createdAt))
		.limit(limit);
}

export type ActivityItem = Awaited<ReturnType<typeof listActivities>>[number];

/** A note / call / WhatsApp / meeting on a booking; it shows on the client's timeline too */
export async function addBookingActivity(db: DbOrTx, input: ActivityInput, userId: string | null) {
	const [b] = await db
		.select({ clientId: booking.clientId })
		.from(booking)
		.where(eq(booking.id, input.bookingId));
	if (!b) throw new ServiceError('Booking tidak ditemukan.');
	const [row] = await db
		.insert(activity)
		.values({
			clientId: b.clientId,
			bookingId: input.bookingId,
			type: input.type,
			body: input.body,
			userId,
			occurredAt: new Date()
		})
		.returning({ id: activity.id });
	return row;
}
