// Clients (P2-02, 03-SCREENS B5): the person who books. Archived = soft delete; bookings stay.
// Every function takes `db` or an open transaction first.
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { activity, booking, client, leadSource } from '../db/schema/index.ts';
import { phoneDisplay } from '../../format.ts';
import type { ClientInput } from '../../schemas/crm.ts';
import { listActivities } from './activity.ts';
import { ServiceError } from './errors.ts';

export type ClientFilter = { q?: string; sourceId?: string | null; archived?: boolean };

/** Escape %, _ and \ for a LIKE pattern */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Lead sources for selects; archived ones only when asked (or when still referenced by `keepId`) */
export async function listLeadSources(db: DbOrTx, keepId?: string | null) {
	return db
		.select({ id: leadSource.id, name: leadSource.name, archived: leadSource.archived })
		.from(leadSource)
		.where(
			keepId
				? or(eq(leadSource.archived, false), eq(leadSource.id, keepId))
				: eq(leadSource.archived, false)
		)
		.orderBy(asc(leadSource.position), asc(leadSource.name));
}

/**
 * Client list with search on name / WhatsApp / email / Instagram. Digits in the query also match
 * the stored `628…` form, so "0812 3456" finds `6281234 56…`.
 */
export async function listClients(db: DbOrTx, filter: ClientFilter = {}) {
	const q = filter.q?.trim() ?? '';
	const where = [filter.archived ? isNotNull(client.archivedAt) : isNull(client.archivedAt)];
	if (filter.sourceId) where.push(eq(client.sourceId, filter.sourceId));
	if (q) {
		const pattern = `%${likeEscape(q)}%`;
		const textMatch = or(
			ilike(client.name, pattern),
			ilike(client.email, pattern),
			ilike(client.instagram, `%${likeEscape(q.replace(/^@/, ''))}%`)
		)!;
		const digits = q.replace(/\D/g, '');
		if (digits.length >= 3) {
			const local = digits.replace(/^(62|0)/, '');
			where.push(or(textMatch, ilike(client.phone, `%${local}%`))!);
		} else where.push(textMatch);
	}

	const bookingCount = db
		.select({ clientId: booking.clientId, n: sql<number>`count(*)::int`.as('n') })
		.from(booking)
		.groupBy(booking.clientId)
		.as('bc');

	return db
		.select({
			id: client.id,
			name: client.name,
			phone: client.phone,
			email: client.email,
			instagram: client.instagram,
			city: client.city,
			sourceId: client.sourceId,
			sourceName: leadSource.name,
			notes: client.notes,
			archivedAt: client.archivedAt,
			createdAt: client.createdAt,
			bookings: sql<number>`coalesce(${bookingCount.n}, 0)`
		})
		.from(client)
		.leftJoin(leadSource, eq(leadSource.id, client.sourceId))
		.leftJoin(bookingCount, eq(bookingCount.clientId, client.id))
		.where(and(...where))
		.orderBy(desc(client.createdAt))
		.limit(500);
}

export async function getClient(db: DbOrTx, id: string) {
	const [row] = await db
		.select({
			id: client.id,
			name: client.name,
			phone: client.phone,
			email: client.email,
			instagram: client.instagram,
			city: client.city,
			sourceId: client.sourceId,
			sourceName: leadSource.name,
			notes: client.notes,
			archivedAt: client.archivedAt,
			createdAt: client.createdAt
		})
		.from(client)
		.leftJoin(leadSource, eq(leadSource.id, client.sourceId))
		.where(eq(client.id, id));
	if (!row) return null;

	const bookings = await db
		.select({
			id: booking.id,
			title: booking.title,
			eventType: booking.eventType,
			stage: booking.stage,
			agreedPrice: booking.agreedPrice,
			bookedAt: booking.bookedAt,
			createdAt: booking.createdAt,
			// Hari H: the earliest dated session. Columns are written out in full: Drizzle renders
			// ${booking.id} unqualified in a single-table select, which would bind to booking_session.id.
			firstDate: sql<
				string | null
			>`(select min(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id")`
		})
		.from(booking)
		.where(eq(booking.clientId, id))
		.orderBy(desc(booking.createdAt));

	const activities = await listActivities(db, { clientId: id }, 100);

	// Payments arrive in Phase 3; until then "paid" is 0 and the outstanding total is the value
	const value = bookings
		.filter((b) => b.stage !== 'lost')
		.reduce((sum, b) => sum + b.agreedPrice, 0);

	return { client: row, bookings, activities, totals: { value, paid: 0, outstanding: value } };
}

/** Exact match on the normalised WhatsApp number (used by the inquiry form in P1-08 too) */
export async function findClientByPhone(db: DbOrTx, phone: string, exceptId?: string) {
	const [row] = await db
		.select({ id: client.id, name: client.name, archivedAt: client.archivedAt })
		.from(client)
		.where(and(eq(client.phone, phone), exceptId ? ne(client.id, exceptId) : undefined))
		.orderBy(asc(client.createdAt))
		.limit(1);
	return row ?? null;
}

async function assertPhoneFree(db: DbOrTx, phone: string | null, exceptId?: string) {
	if (!phone) return;
	const other = await findClientByPhone(db, phone, exceptId);
	if (other)
		throw new ServiceError(
			`Nomor ${phoneDisplay(phone)} sudah dipakai klien ${other.name}${other.archivedAt ? ' (diarsipkan)' : ''}.`,
			'phone'
		);
}

async function assertSource(db: DbOrTx, sourceId: string | null) {
	if (!sourceId) return;
	const [s] = await db
		.select({ id: leadSource.id })
		.from(leadSource)
		.where(eq(leadSource.id, sourceId));
	if (!s) throw new ServiceError('Sumber tidak ditemukan.', 'sourceId');
}

/** Insert + "Klien ditambahkan" activity in one transaction */
export async function createClient(db: DbOrTx, input: ClientInput, userId: string | null) {
	return db.transaction(async (tx) => {
		await assertPhoneFree(tx, input.phone);
		await assertSource(tx, input.sourceId);
		const [row] = await tx.insert(client).values(input).returning({ id: client.id });
		await tx.insert(activity).values({
			clientId: row.id,
			type: 'system',
			body: 'Klien ditambahkan',
			userId,
			occurredAt: new Date()
		});
		return row;
	});
}

export async function updateClient(db: DbOrTx, id: string, input: ClientInput) {
	await assertPhoneFree(db, input.phone, id);
	await assertSource(db, input.sourceId);
	const [row] = await db
		.update(client)
		.set(input)
		.where(eq(client.id, id))
		.returning({ id: client.id });
	if (!row) throw new ServiceError('Klien tidak ditemukan.');
	return row;
}

/** Archive hides the client from the list and pickers; bookings and history stay */
export async function setClientArchived(db: DbOrTx, id: string, archived: boolean) {
	const [row] = await db
		.update(client)
		.set({ archivedAt: archived ? new Date() : null })
		.where(eq(client.id, id))
		.returning({ id: client.id, name: client.name });
	if (!row) throw new ServiceError('Klien tidak ditemukan.');
	return row;
}
