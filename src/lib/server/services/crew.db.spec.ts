// DB spec for crew (client feedback 11 Nov 2026). Neon `dev` branch (NEON_BRANCH=dev) or
// localhost only; every case runs in a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import { booking } from '../db/schema/index';
import { createBooking, getBookingForEdit, listBoard, updateBooking } from './bookings';
import { listCalendar } from './calendar';
import { createCrew, crewJobs, deleteCrew, listCrew, updateCrew } from './crew';
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

/** Far-future month so seed data never falls in it */
const MONTH = { from: '2093-03-01', to: '2093-03-31' };

const input = (phone: string, crewIds: string[], date = '2093-03-10') =>
	bookingSchema.parse({
		newClientName: `E2E Crew Spec ${phone}`,
		newClientPhone: phone,
		title: `E2E Crew ${phone}`,
		eventType: 'wedding',
		agreedPrice: '1000000',
		sessions: JSON.stringify([
			{ eventType: 'akad', date, startTime: '08:00' },
			{ eventType: 'resepsi', date }
		]),
		crewIds: JSON.stringify(crewIds)
	});

async function rejects(p: Promise<unknown>, text: RegExp) {
	const e = await p.then(
		() => null,
		(err: unknown) => err
	);
	expect(e).toBeInstanceOf(ServiceError);
	expect((e as ServiceError).message).toMatch(text);
}

/** Booked onward needs a paid DP: set it straight in the row for the count cases */
const setStage = (tx: Tx, id: string, stage: 'booked' | 'completed' | 'lost' | 'quotation') =>
	tx
		.update(booking)
		.set({
			stage,
			bookedAt: stage === 'quotation' ? null : new Date(),
			lostReason: stage === 'lost' ? 'Spec' : null
		})
		.where(eq(booking.id, id));

describe.runIf(isDevDb)('crew', () => {
	it('assigns 0-2 crew per booking; inactive crew can stay but not be added', () =>
		inRollback(async (tx) => {
			const andi = await createCrew(tx, {
				name: 'E2E Andi',
				role: 'Fotografer',
				phone: '6281200000001',
				active: true
			});
			const budi = await createCrew(tx, { name: 'E2E Budi', role: '', phone: null, active: true });
			const sari = await createCrew(tx, { name: 'E2E Sari', role: '', phone: null, active: true });

			const none = await createBooking(tx, input('0899-7009-0001', []), null);
			expect((await getBookingForEdit(tx, none.id))!.crewIds).toEqual([]);

			const two = await createBooking(tx, input('0899-7009-0002', [budi.id, andi.id]), null);
			expect((await getBookingForEdit(tx, two.id))!.crewIds.sort()).toEqual(
				[andi.id, budi.id].sort()
			);
			// The board card lists them in name order
			const card = (await listBoard(tx)).find((c) => c.id === two.id)!;
			expect(card.crew.map((k) => k.name)).toEqual(['E2E Andi', 'E2E Budi']);

			// Three is one too many (the form schema refuses it too)
			expect(() => input('0899-7009-0003', [andi.id, budi.id, sari.id])).toThrow();
			await rejects(
				createBooking(
					tx,
					{ ...input('0899-7009-0003', []), crewIds: [andi.id, budi.id, sari.id] },
					null
				),
				/Maksimal 2 kru/
			);

			// Edits reuse the booking's client (no inline new client)
			const edit = (b: { clientId: string }, phone: string, crewIds: string[]) => ({
				...input(phone, crewIds),
				clientId: b.clientId,
				newClientName: null,
				newClientPhone: null
			});

			// Deactivated: stays on the booking it is on, cannot be added to another
			await updateCrew(tx, andi.id, {
				name: 'E2E Andi',
				role: 'Fotografer',
				phone: null,
				active: false
			});
			await updateBooking(tx, two.id, edit(two, '0899-7009-0002', [andi.id, budi.id]), null);
			await rejects(
				updateBooking(tx, none.id, edit(none, '0899-7009-0001', [andi.id]), null),
				/nonaktif/
			);

			// Delete only when never assigned
			await rejects(deleteCrew(tx, budi.id), /Nonaktifkan/);
			await deleteCrew(tx, sari.id);
			expect((await listCrew(tx, MONTH)).some((c) => c.id === sari.id)).toBe(false);
		}));

	it('counts bookings from Booked on, never Batal, by Hari H in the period; lists the jobs', () =>
		inRollback(async (tx) => {
			const andi = await createCrew(tx, { name: 'E2E Andi', role: '', phone: null, active: true });
			const budi = await createCrew(tx, { name: 'E2E Budi', role: '', phone: null, active: true });

			const booked = await createBooking(tx, input('0899-7009-0011', [andi.id, budi.id]), null);
			const done = await createBooking(tx, input('0899-7009-0012', [andi.id], '2093-03-20'), null);
			const lost = await createBooking(tx, input('0899-7009-0013', [andi.id]), null);
			const tentative = await createBooking(tx, input('0899-7009-0014', [andi.id]), null);
			const nextMonth = await createBooking(
				tx,
				input('0899-7009-0015', [andi.id], '2093-04-02'),
				null
			);
			await setStage(tx, booked.id, 'booked');
			await setStage(tx, done.id, 'completed');
			await setStage(tx, lost.id, 'lost');
			await setStage(tx, tentative.id, 'quotation');
			await setStage(tx, nextMonth.id, 'booked');

			const rows = await listCrew(tx, MONTH);
			expect(rows.find((c) => c.id === andi.id)).toMatchObject({ bookings: 2, assigned: 5 });
			expect(rows.find((c) => c.id === budi.id)).toMatchObject({ bookings: 1, assigned: 1 });

			const jobs = await crewJobs(tx, andi.id, MONTH);
			expect(jobs.map((j) => j.id)).toEqual([booked.id, done.id]);
			expect(jobs[0]).toMatchObject({ hariH: '2093-03-10', stage: 'booked' });
			expect(jobs[0].sessions.map((s) => s.eventType)).toEqual(['akad', 'resepsi']);

			// Kalender: each session knows its booking's crew (chip colour)
			const cal = await listCalendar(tx, MONTH);
			const items = cal.items.filter((i) => i.bookingId === booked.id);
			expect(items).toHaveLength(2);
			expect(items[0]).toMatchObject({ crewCount: 2, crew: ['E2E Andi', 'E2E Budi'] });
			expect(cal.items.find((i) => i.bookingId === tentative.id)).toMatchObject({
				crewCount: 1,
				booked: false
			});
		}));
});
