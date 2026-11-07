// DB spec for bookings (P2-03). Neon `dev` branch (NEON_BRANCH=dev) or localhost only;
// every case runs in a transaction that is rolled back.
import { asc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema, type BookingInput } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import {
	activity,
	addon,
	booking,
	bookingAddon,
	bookingSession,
	packageCategory,
	pkg
} from '../db/schema/index';
import {
	createBooking,
	getBookingForEdit,
	listBoard,
	listBookings,
	moveBooking,
	sameDateBookings,
	updateBooking
} from './bookings';
import { ServiceError } from './errors';

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

/** Far-future dates so seed data never shares them */
const D1 = '2031-02-14';
const D2 = '2031-02-15';

function input(over: Record<string, unknown> = {}): BookingInput {
	return bookingSchema.parse({
		newClientName: 'E2E CRM Spec Booking',
		newClientPhone: '0899-7002-0001',
		title: 'E2E CRM Wedding Spec',
		eventType: 'wedding',
		agreedPrice: '9500000',
		sessions: JSON.stringify([
			{ eventType: 'resepsi', date: D2, startTime: '18:00', endTime: '21:00', venue: 'Gedung' },
			{ eventType: 'akad', date: D1, startTime: '08:00' }
		]),
		addons: '[]',
		...over
	});
}

const move = (id: string, to: string, extra: Record<string, unknown> = {}) => ({
	id,
	to: to as never,
	beforeId: null,
	afterId: null,
	lostReason: null,
	confirmBalance: false,
	...extra
});

async function rejects(p: Promise<unknown>, field: string) {
	const e = await p.then(
		() => null,
		(err: unknown) => err
	);
	expect(e).toBeInstanceOf(ServiceError);
	expect((e as ServiceError).field).toBe(field);
}

describe('bookingSchema', () => {
	it('needs a client, a title and at least one session; validates times', () => {
		const r = bookingSchema.safeParse({
			title: '',
			eventType: 'wedding',
			agreedPrice: '0',
			sessions: JSON.stringify([{ eventType: 'akad', startTime: '10:00', endTime: '09:00' }])
		});
		expect(r.success).toBe(false);
		const paths = r.error!.issues.map((i) => i.path.join('.'));
		expect(paths).toEqual(expect.arrayContaining(['title', 'sessions.0.endTime', 'clientId']));
		expect(
			bookingSchema.safeParse({ ...input(), sessions: '[]', addons: '[]', newClientName: 'X' })
				.success
		).toBe(false);
	});
});

describe.runIf(isDevDb)('bookings service', () => {
	it('creates a booking with an inline client, sessions, add-ons and a package snapshot', () =>
		inRollback(async (tx) => {
			const [cat] = await tx
				.insert(packageCategory)
				.values({ name: 'E2E CRM Cat', position: 'a0' })
				.returning();
			const [p] = await tx
				.insert(pkg)
				.values({
					categoryId: cat.id,
					name: 'E2E Gold',
					price: 9_000_000,
					inclusions: ['2 videografer'],
					position: 'a0'
				})
				.returning();
			const [a] = await tx
				.insert(addon)
				.values({ name: 'E2E SDE', price: 500_000, position: 'a0' })
				.returning();

			const made = await createBooking(
				tx,
				input({
					packageId: p.id,
					addons: JSON.stringify([
						{ addonId: a.id, name: 'E2E SDE', unitPrice: 500_000, qty: 1 },
						{ addonId: null, name: 'Drone', unitPrice: 0, qty: 2 }
					])
				}),
				null
			);
			const b = await getBookingForEdit(tx, made.id);
			expect(b).toMatchObject({
				stage: 'inquiry',
				agreedPrice: 9_500_000,
				packageSnapshot: {
					name: 'E2E Gold',
					price: 9_000_000,
					inclusions: ['2 videografer'],
					category: 'E2E CRM Cat'
				}
			});
			// Sessions come back in date order (akad first = Hari H)
			expect(b!.sessions.map((s) => s.date)).toEqual([D1, D2]);
			expect(b!.addons).toHaveLength(2);

			// Site edits don't change the booking; an edit that keeps the package keeps the snapshot
			await tx.update(pkg).set({ price: 1 }).where(eq(pkg.id, p.id));
			await updateBooking(tx, made.id, input({ clientId: made.clientId, packageId: p.id }), null);
			expect((await getBookingForEdit(tx, made.id))!.packageSnapshot?.price).toBe(9_000_000);
			expect((await getBookingForEdit(tx, made.id))!.addons).toHaveLength(0);

			// Inline client with a WhatsApp that already exists is refused
			await rejects(createBooking(tx, input(), null), 'newClientPhone');
		}));

	it('puts new cards on top and keeps dropped positions', () =>
		inRollback(async (tx) => {
			const a = await createBooking(tx, input(), null);
			const b = await createBooking(
				tx,
				input({ clientId: a.clientId, newClientName: '', newClientPhone: '' }),
				null
			);
			const c = await createBooking(
				tx,
				input({ clientId: a.clientId, newClientName: '', newClientPhone: '' }),
				null
			);
			const order = async () =>
				(await listBoard(tx))
					.filter((x) => x.stage === 'inquiry' && [a.id, b.id, c.id].includes(x.id))
					.map((x) => x.id);
			expect(await order()).toEqual([c.id, b.id, a.id]);

			// Drop a between c and b
			await moveBooking(tx, move(a.id, 'inquiry', { beforeId: c.id, afterId: b.id }), null);
			expect(await order()).toEqual([c.id, a.id, b.id]);

			// Stale neighbour → bottom of the column
			await moveBooking(
				tx,
				move(c.id, 'inquiry', { beforeId: '00000000-0000-0000-0000-000000000000' }),
				null
			);
			expect((await order()).at(-1)).toBe(c.id);
		}));

	it('refuses Booked and later without a paid DP; Batal needs a reason; Selesai warns', () =>
		inRollback(async (tx) => {
			const { id } = await createBooking(tx, input(), null);
			for (const stage of ['booked', 'preparation', 'event_day', 'editing', 'completed'])
				await rejects(moveBooking(tx, move(id, stage), null), 'dp');

			await moveBooking(tx, move(id, 'quotation'), null);
			await rejects(moveBooking(tx, move(id, 'lost'), null), 'lostReason');
			await moveBooking(tx, move(id, 'lost', { lostReason: 'Pilih vendor lain' }), null);
			const [lost] = await tx.select().from(booking).where(eq(booking.id, id));
			expect(lost).toMatchObject({ stage: 'lost', lostReason: 'Pilih vendor lain' });

			// DP paid (P3-04 sets booked_at): Booked is allowed; Selesai asks to confirm the balance
			await tx.update(booking).set({ bookedAt: new Date() }).where(eq(booking.id, id));
			await moveBooking(tx, move(id, 'booked'), null);
			const [back] = await tx.select().from(booking).where(eq(booking.id, id));
			expect(back).toMatchObject({ stage: 'booked', lostReason: null });
			await rejects(moveBooking(tx, move(id, 'completed'), null), 'confirmBalance');
			await moveBooking(tx, move(id, 'completed', { confirmBalance: true }), null);

			const log = await tx
				.select({ meta: activity.meta, body: activity.body })
				.from(activity)
				.where(eq(activity.bookingId, id))
				.orderBy(asc(activity.occurredAt), asc(activity.createdAt));
			expect(log.filter((l) => l.meta).map((l) => l.meta)).toEqual([
				{ from: 'inquiry', to: 'quotation' },
				{ from: 'quotation', to: 'lost' },
				{ from: 'lost', to: 'booked' },
				{ from: 'booked', to: 'completed' }
			]);
			expect(log.map((l) => l.body)).toContain('Alasan: Pilih vendor lain');
		}));

	it('warns about other bookings on the same date, ignoring Batal and itself', () =>
		inRollback(async (tx) => {
			const a = await createBooking(tx, input(), null);
			const b = await createBooking(
				tx,
				input({
					clientId: a.clientId,
					newClientName: '',
					newClientPhone: '',
					title: 'E2E CRM Other',
					sessions: JSON.stringify([{ eventType: 'lamaran', date: D2 }])
				}),
				null
			);
			const same = await sameDateBookings(tx, [D1, D2], a.id);
			expect(same[D1]).toBeUndefined();
			expect(same[D2]?.map((x) => x.id)).toEqual([b.id]);

			await moveBooking(tx, move(b.id, 'lost', { lostReason: 'Batal' }), null);
			expect((await sameDateBookings(tx, [D2], a.id))[D2]).toBeUndefined();
		}));

	it('filters the list by text, stage, event type and session month', () =>
		inRollback(async (tx) => {
			const { id } = await createBooking(tx, input(), null);
			const ids = async (f: Parameters<typeof listBookings>[1]) =>
				(await listBookings(tx, f)).map((r) => r.id);
			expect(await ids({ q: 'wedding spec' })).toContain(id);
			expect(await ids({ q: 'spec booking' })).toContain(id); // client name
			expect(await ids({ stage: 'inquiry', eventType: 'wedding' })).toContain(id);
			expect(await ids({ stage: 'quotation' })).not.toContain(id);
			expect(await ids({ month: '2031-02' })).toContain(id);
			expect(await ids({ month: '2031-03' })).not.toContain(id);
			const row = (await listBookings(tx, { q: 'wedding spec' })).find((r) => r.id === id);
			expect(row).toMatchObject({ firstDate: D1, sessions: 2 });
			// sanity: lines really written
			expect(
				await tx.select().from(bookingSession).where(eq(bookingSession.bookingId, id))
			).toHaveLength(2);
			expect(
				await tx.select().from(bookingAddon).where(eq(bookingAddon.bookingId, id))
			).toHaveLength(0);
		}));
});
