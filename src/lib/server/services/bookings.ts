// Bookings (P2-03, 01-PRD §6, 03-SCREENS B4): board, list, create / edit with sessions and
// add-ons, stage moves. Every function takes `db` or an open transaction first.
import { and, asc, desc, eq, ilike, inArray, isNull, max, min, ne, or, sql } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import type { DbOrTx } from '../db/client.ts';
import {
	activity,
	addon,
	booking,
	bookingAddon,
	bookingSession,
	client,
	packageCategory,
	pkg,
	type PackageSnapshot
} from '../db/schema/index.ts';
import { BOOKED_STAGES, STAGE_LABEL, type EventType, type Stage } from '../../crm.ts';
import { dayKeyWib, rupiah } from '../../format.ts';
import type {
	BookingFilter,
	BookingInput,
	BookingMoveInput,
	DeliveryInput
} from '../../schemas/crm.ts';
import { findClientByPhone } from './clients.ts';
import { ServiceError } from './errors.ts';
import { ensureSchedule } from './installments.ts';

/** ServiceError fields the board reacts to with a modal */
export const MOVE_NEEDS = {
	dp: 'dp',
	lostReason: 'lostReason',
	confirmBalance: 'confirmBalance'
} as const;

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------- card order (fractional index per stage column) ----------

async function bottomOf(db: DbOrTx, stage: Stage, exceptId?: string) {
	const [{ last }] = await db
		.select({ last: max(booking.position) })
		.from(booking)
		.where(and(eq(booking.stage, stage), exceptId ? ne(booking.id, exceptId) : undefined));
	return generateKeyBetween(last ?? null, null);
}

async function topOf(db: DbOrTx, stage: Stage) {
	const [{ first }] = await db
		.select({ first: min(booking.position) })
		.from(booking)
		.where(eq(booking.stage, stage));
	return generateKeyBetween(null, first ?? null);
}

/**
 * Key for a card dropped between `beforeId` (above) and `afterId` (below) in `stage`.
 * Unknown or stale neighbours (moved meanwhile) put the card at the bottom.
 */
async function positionBetween(
	db: DbOrTx,
	stage: Stage,
	beforeId: string | null,
	afterId: string | null,
	movingId: string
) {
	const ids = [beforeId, afterId].filter((v): v is string => !!v);
	const rows = ids.length
		? await db
				.select({ id: booking.id, stage: booking.stage, position: booking.position })
				.from(booking)
				.where(inArray(booking.id, ids))
		: [];
	const pos = (id: string | null) =>
		id ? (rows.find((n) => n.id === id && n.stage === stage)?.position ?? undefined) : null;
	const a = pos(beforeId);
	const b = pos(afterId);
	if (a === undefined || b === undefined || (a !== null && b !== null && a >= b))
		return bottomOf(db, stage, movingId);
	if (a === null && b === null) return bottomOf(db, stage, movingId);
	return generateKeyBetween(a, b);
}

// ---------- reads ----------

/** Earliest dated session = Hari H. Columns written out: Drizzle leaves ${booking.id} unqualified. */
const firstDateSql = sql<
	string | null
>`(select min(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id")`;

/** Next session from `today` on; falls back to the latest past one */
const nextDateSql = (today: string) =>
	sql<
		string | null
	>`coalesce((select min(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id" and bs.date >= ${today}::date), (select max(bs.date)::text from "booking_session" bs where bs.booking_id = "booking"."id"))`;

/** Every booking for the board, in card order per column */
export async function listBoard(db: DbOrTx, today = dayKeyWib()) {
	return db
		.select({
			id: booking.id,
			title: booking.title,
			stage: booking.stage,
			position: booking.position,
			eventType: booking.eventType,
			agreedPrice: booking.agreedPrice,
			bookedAt: booking.bookedAt,
			packageName: sql<string | null>`${booking.packageSnapshot}->>'name'`,
			clientId: booking.clientId,
			clientName: client.name,
			nextDate: nextDateSql(today)
		})
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.orderBy(asc(booking.position), asc(booking.createdAt));
}

export type BoardCard = Awaited<ReturnType<typeof listBoard>>[number];

/** Booking list (table view) with search, stage, event type and session-month filters */
export async function listBookings(db: DbOrTx, filter: Partial<BookingFilter> = {}) {
	const where = [];
	const q = filter.q?.trim();
	if (q) {
		const p = `%${likeEscape(q)}%`;
		where.push(or(ilike(booking.title, p), ilike(client.name, p)));
	}
	if (filter.stage) where.push(eq(booking.stage, filter.stage));
	if (filter.eventType) where.push(eq(booking.eventType, filter.eventType));
	if (filter.month) {
		const start = `${filter.month}-01`;
		where.push(
			sql`exists (select 1 from "booking_session" bs where bs.booking_id = "booking"."id" and bs.date >= ${start}::date and bs.date < (${start}::date + interval '1 month'))`
		);
	}
	return db
		.select({
			id: booking.id,
			title: booking.title,
			stage: booking.stage,
			eventType: booking.eventType,
			agreedPrice: booking.agreedPrice,
			bookedAt: booking.bookedAt,
			packageName: sql<string | null>`${booking.packageSnapshot}->>'name'`,
			clientId: booking.clientId,
			clientName: client.name,
			firstDate: firstDateSql,
			sessions: sql<number>`(select count(*)::int from "booking_session" bs where bs.booking_id = "booking"."id")`
		})
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(where.length ? and(...where) : undefined)
		.orderBy(sql`${firstDateSql} asc nulls last`, desc(booking.createdAt))
		.limit(500);
}

/**
 * Other bookings (not Batal) with a session on each of `dates`: the same-date warning (D13).
 * Allowed, never blocked.
 */
export async function sameDateBookings(
	db: DbOrTx,
	dates: string[],
	exceptBookingId?: string | null
) {
	const wanted = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
	if (!wanted.length) return {} as Record<string, { id: string; title: string }[]>;
	const rows = await db
		.selectDistinct({ date: bookingSession.date, id: booking.id, title: booking.title })
		.from(bookingSession)
		.innerJoin(booking, eq(booking.id, bookingSession.bookingId))
		.where(
			and(
				inArray(bookingSession.date, wanted),
				ne(booking.stage, 'lost'),
				exceptBookingId ? ne(booking.id, exceptBookingId) : undefined
			)
		)
		.orderBy(asc(booking.title));
	const out: Record<string, { id: string; title: string }[]> = {};
	for (const r of rows) (out[r.date!] ??= []).push({ id: r.id, title: r.title });
	return out;
}

/** Booking with its sessions and add-on lines, for the edit drawer */
export async function getBookingForEdit(db: DbOrTx, id: string) {
	const [row] = await db
		.select({
			id: booking.id,
			title: booking.title,
			stage: booking.stage,
			eventType: booking.eventType,
			clientId: booking.clientId,
			clientName: client.name,
			packageId: booking.packageId,
			packageSnapshot: booking.packageSnapshot,
			agreedPrice: booking.agreedPrice,
			bookedAt: booking.bookedAt,
			notes: booking.notes
		})
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(eq(booking.id, id));
	if (!row) return null;
	const [sessions, addons] = await Promise.all([
		db
			.select({
				eventType: bookingSession.eventType,
				date: bookingSession.date,
				startTime: bookingSession.startTime,
				endTime: bookingSession.endTime,
				venue: bookingSession.venue,
				city: bookingSession.city,
				notes: bookingSession.notes
			})
			.from(bookingSession)
			.where(eq(bookingSession.bookingId, id))
			.orderBy(sql`${bookingSession.date} asc nulls last`, asc(bookingSession.sort)),
		db
			.select({
				addonId: bookingAddon.addonId,
				name: bookingAddon.name,
				unitPrice: bookingAddon.unitPrice,
				qty: bookingAddon.qty
			})
			.from(bookingAddon)
			.where(eq(bookingAddon.bookingId, id))
			.orderBy(asc(bookingAddon.createdAt))
	]);
	return { ...row, sessions, addons };
}

export type BookingForEdit = NonNullable<Awaited<ReturnType<typeof getBookingForEdit>>>;

/** Booking page (03-SCREENS B4): the booking, its client's contacts, sessions and add-on lines */
export async function getBookingDetail(db: DbOrTx, id: string) {
	const [row] = await db
		.select({
			id: booking.id,
			title: booking.title,
			stage: booking.stage,
			eventType: booking.eventType,
			origin: booking.origin,
			inquiryMessage: booking.inquiryMessage,
			lostReason: booking.lostReason,
			packageSnapshot: booking.packageSnapshot,
			agreedPrice: booking.agreedPrice,
			bookedAt: booking.bookedAt,
			stageChangedAt: booking.stageChangedAt,
			deliveryLink: booking.deliveryLink,
			rawDeliveredOn: booking.rawDeliveredOn,
			editedDeliveredOn: booking.editedDeliveredOn,
			notes: booking.notes,
			createdAt: booking.createdAt,
			firstDate: firstDateSql,
			client: {
				id: client.id,
				name: client.name,
				phone: client.phone,
				instagram: client.instagram,
				email: client.email
			}
		})
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(eq(booking.id, id));
	if (!row) return null;
	const [sessions, addons] = await Promise.all([
		db
			.select({
				id: bookingSession.id,
				eventType: bookingSession.eventType,
				date: bookingSession.date,
				startTime: bookingSession.startTime,
				endTime: bookingSession.endTime,
				venue: bookingSession.venue,
				city: bookingSession.city,
				notes: bookingSession.notes
			})
			.from(bookingSession)
			.where(eq(bookingSession.bookingId, id))
			.orderBy(sql`${bookingSession.date} asc nulls last`, asc(bookingSession.sort)),
		db
			.select({
				id: bookingAddon.id,
				name: bookingAddon.name,
				unitPrice: bookingAddon.unitPrice,
				qty: bookingAddon.qty
			})
			.from(bookingAddon)
			.where(eq(bookingAddon.bookingId, id))
			.orderBy(asc(bookingAddon.createdAt))
	]);
	return { ...row, sessions, addons };
}

export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;

/** Packages (visible or not: hidden ones stay selectable) and active add-ons for the form */
export async function bookingFormOptions(db: DbOrTx) {
	const [packages, addons, clients] = await Promise.all([
		db
			.select({
				id: pkg.id,
				name: pkg.name,
				price: pkg.price,
				visible: pkg.visible,
				category: packageCategory.name
			})
			.from(pkg)
			.innerJoin(packageCategory, eq(packageCategory.id, pkg.categoryId))
			.orderBy(asc(packageCategory.position), asc(pkg.position)),
		db
			.select({ id: addon.id, name: addon.name, price: addon.price })
			.from(addon)
			.where(eq(addon.active, true))
			.orderBy(asc(addon.position)),
		db
			.select({ id: client.id, name: client.name, phone: client.phone })
			.from(client)
			.where(isNull(client.archivedAt))
			.orderBy(asc(client.name))
			.limit(2000)
	]);
	return { packages, addons, clients };
}

// ---------- writes ----------

async function packageSnapshot(db: DbOrTx, packageId: string): Promise<PackageSnapshot> {
	const [p] = await db
		.select({
			name: pkg.name,
			price: pkg.price,
			inclusions: pkg.inclusions,
			category: packageCategory.name
		})
		.from(pkg)
		.innerJoin(packageCategory, eq(packageCategory.id, pkg.categoryId))
		.where(eq(pkg.id, packageId));
	if (!p) throw new ServiceError('Paket tidak ditemukan.', 'packageId');
	return p;
}

/** Existing client, or the inline new one (refused when the WhatsApp already belongs to someone) */
async function resolveClient(db: DbOrTx, input: BookingInput, userId: string | null) {
	if (input.clientId) {
		const [c] = await db
			.select({ id: client.id })
			.from(client)
			.where(eq(client.id, input.clientId));
		if (!c) throw new ServiceError('Klien tidak ditemukan.', 'clientId');
		return c.id;
	}
	if (input.newClientPhone) {
		const other = await findClientByPhone(db, input.newClientPhone);
		if (other)
			throw new ServiceError(
				`Nomor ini sudah dipakai klien ${other.name}. Pilih klien itu dari daftar.`,
				'newClientPhone'
			);
	}
	const [c] = await db
		.insert(client)
		.values({ name: input.newClientName!, phone: input.newClientPhone })
		.returning({ id: client.id });
	await db.insert(activity).values({
		clientId: c.id,
		type: 'system',
		body: 'Klien ditambahkan',
		userId,
		occurredAt: new Date()
	});
	return c.id;
}

async function assertAddons(db: DbOrTx, input: BookingInput) {
	const ids = [...new Set(input.addons.map((a) => a.addonId).filter((v): v is string => !!v))];
	if (!ids.length) return;
	const found = await db.select({ id: addon.id }).from(addon).where(inArray(addon.id, ids));
	if (found.length !== ids.length) throw new ServiceError('Add-on tidak ditemukan.', 'addons');
}

async function writeLines(db: DbOrTx, bookingId: string, input: BookingInput) {
	await db
		.insert(bookingSession)
		.values(input.sessions.map((s, i) => ({ bookingId, ...s, sort: i })));
	if (input.addons.length)
		await db.insert(bookingAddon).values(input.addons.map((a) => ({ bookingId, ...a })));
}

export type InquiryBookingInput = {
	clientId: string;
	title: string;
	eventType: EventType;
	/** From `?paket=`; an unknown or deleted package is ignored, never an error for a visitor */
	packageId?: string | null;
	message?: string | null;
	/** "Tanggal acara (utama)" (yyyy-MM-dd); becomes the first session */
	sessionDate?: string | null;
	venue?: string | null;
	city?: string | null;
};

/**
 * Booking for a website inquiry (P1-08): Inquiry column top, origin `website_form`, package
 * snapshot, one session (dated when the form gave a date) and a system activity. Runs on the
 * caller's transaction, so the client match / create and this insert commit together.
 */
export async function createInquiryBooking(db: DbOrTx, input: InquiryBookingInput) {
	let snapshot: PackageSnapshot | null = null;
	let packageId: string | null = null;
	if (input.packageId) {
		try {
			snapshot = await packageSnapshot(db, input.packageId);
			packageId = input.packageId;
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
		}
	}
	const now = new Date();
	const [row] = await db
		.insert(booking)
		.values({
			clientId: input.clientId,
			title: input.title,
			eventType: input.eventType,
			packageId,
			packageSnapshot: snapshot,
			agreedPrice: snapshot?.price ?? 0,
			stage: 'inquiry',
			position: await topOf(db, 'inquiry'),
			origin: 'website_form',
			inquiryMessage: input.message || null,
			stageChangedAt: now
		})
		.returning({ id: booking.id });
	await db.insert(bookingSession).values({
		bookingId: row.id,
		eventType: input.eventType,
		date: input.sessionDate || null,
		venue: input.venue || null,
		city: input.city || null,
		sort: 0
	});
	await ensureSchedule(db, row.id);
	await db.insert(activity).values({
		clientId: input.clientId,
		bookingId: row.id,
		type: 'system',
		body: 'Inquiry masuk dari formulir website',
		userId: null,
		occurredAt: now
	});
	return { id: row.id };
}

/** New booking at the top of its column, with sessions, add-ons and a package snapshot */
export async function createBooking(db: DbOrTx, input: BookingInput, userId: string | null) {
	return db.transaction(async (tx) => {
		const clientId = await resolveClient(tx, input, userId);
		await assertAddons(tx, input);
		const snapshot = input.packageId ? await packageSnapshot(tx, input.packageId) : null;
		const now = new Date();
		const [row] = await tx
			.insert(booking)
			.values({
				clientId,
				title: input.title,
				eventType: input.eventType,
				packageId: input.packageId,
				packageSnapshot: snapshot,
				agreedPrice: input.agreedPrice,
				stage: input.stage,
				position: await topOf(tx, input.stage),
				origin: 'manual',
				notes: input.notes,
				stageChangedAt: now
			})
			.returning({ id: booking.id });
		await writeLines(tx, row.id, input);
		await ensureSchedule(tx, row.id);
		await tx.insert(activity).values({
			clientId,
			bookingId: row.id,
			type: 'system',
			body: `Booking dibuat di tahap ${STAGE_LABEL[input.stage]}`,
			userId,
			occurredAt: now
		});
		return { id: row.id, clientId };
	});
}

/**
 * Edit everything except the stage (moves go through moveBooking). Sessions and add-on lines are
 * replaced. The package snapshot is kept unless another package is picked.
 */
export async function updateBooking(
	db: DbOrTx,
	id: string,
	input: BookingInput,
	userId: string | null
) {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select({ packageId: booking.packageId, packageSnapshot: booking.packageSnapshot })
			.from(booking)
			.where(eq(booking.id, id))
			.for('update');
		if (!current) throw new ServiceError('Booking tidak ditemukan.');
		const clientId = await resolveClient(tx, input, userId);
		await assertAddons(tx, input);
		const snapshot =
			input.packageId === current.packageId
				? current.packageSnapshot
				: input.packageId
					? await packageSnapshot(tx, input.packageId)
					: null;
		await tx
			.update(booking)
			.set({
				clientId,
				title: input.title,
				eventType: input.eventType,
				packageId: input.packageId,
				packageSnapshot: snapshot,
				agreedPrice: input.agreedPrice,
				notes: input.notes
			})
			.where(eq(booking.id, id));
		await tx.delete(bookingSession).where(eq(bookingSession.bookingId, id));
		await tx.delete(bookingAddon).where(eq(bookingAddon.bookingId, id));
		await writeLines(tx, id, input);
		// price, add-ons or sessions may have changed: DP / pelunasan amounts and due date
		await ensureSchedule(tx, id);
		return { id, clientId };
	});
}

/** Pengiriman card: link + raw / edited delivery dates */
export async function updateDelivery(db: DbOrTx, input: DeliveryInput) {
	const [row] = await db
		.update(booking)
		.set({
			deliveryLink: input.deliveryLink,
			rawDeliveredOn: input.rawDeliveredOn,
			editedDeliveredOn: input.editedDeliveredOn
		})
		.where(eq(booking.id, input.id))
		.returning({ id: booking.id });
	if (!row) throw new ServiceError('Booking tidak ditemukan.');
	return row;
}

/** Money received for a booking. Payments arrive in P3-04; until then nothing is paid. */
async function paidTotal(db: DbOrTx, bookingId: string): Promise<number> {
	void db;
	void bookingId;
	return 0;
}

/**
 * Move a card (01-PRD §6). In one transaction: the rules, the new position, `stage_changed_at`
 * and a stage-change activity.
 * - Booked and later need the DP paid (`booked_at`) → ServiceError field `dp`
 * - Batal needs a reason → field `lostReason`
 * - Selesai with an outstanding balance needs `confirmBalance` → field `confirmBalance`
 */
export async function moveBooking(db: DbOrTx, input: BookingMoveInput, userId: string | null) {
	return db.transaction(async (tx) => {
		const [current] = await tx.select().from(booking).where(eq(booking.id, input.id)).for('update');
		if (!current) throw new ServiceError('Booking tidak ditemukan.');
		const from = current.stage;
		const to = input.to;

		const position = await positionBetween(tx, to, input.beforeId, input.afterId, current.id);
		if (from === to) {
			await tx.update(booking).set({ position }).where(eq(booking.id, current.id));
			return { from, to, changed: false };
		}

		if (BOOKED_STAGES.includes(to) && !current.bookedAt)
			throw new ServiceError(
				`DP belum lunas. Catat pembayaran DP dulu sebelum memindahkan ke ${STAGE_LABEL[to]}.`,
				MOVE_NEEDS.dp
			);
		if (to === 'lost' && !input.lostReason)
			throw new ServiceError('Tulis alasan batal.', MOVE_NEEDS.lostReason);
		if (to === 'completed' && !input.confirmBalance) {
			const balance = current.agreedPrice - (await paidTotal(tx, current.id));
			if (balance > 0)
				throw new ServiceError(
					`Masih ada sisa tagihan ${rupiah(balance)}. Tetap tandai Selesai?`,
					MOVE_NEEDS.confirmBalance
				);
		}

		const now = new Date();
		await tx
			.update(booking)
			.set({
				stage: to,
				position,
				stageChangedAt: now,
				// leaving Batal clears the old reason
				lostReason: to === 'lost' ? input.lostReason : null
			})
			.where(eq(booking.id, current.id));
		await tx.insert(activity).values({
			clientId: current.clientId,
			bookingId: current.id,
			type: 'stage_change',
			body: to === 'lost' ? `Alasan: ${input.lostReason}` : null,
			meta: { from, to },
			userId,
			occurredAt: now
		});
		// Batal cancels the pelunasan, leaving Batal restores it (P3-02 voids unpaid invoices here)
		await ensureSchedule(tx, current.id);
		return { from, to, changed: true };
	});
}
