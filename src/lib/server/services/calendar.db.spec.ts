// DB spec for the calendar (P2-05). Neon `dev` branch (NEON_BRANCH=dev) or localhost only;
// every case runs in a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import { booking } from '../db/schema/index';
import { createBooking } from './bookings';
import { listCalendar } from './calendar';

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

/** A far-future month no seed booking uses */
const DAY = '2033-05-14';
const NEXT = '2033-05-15';
const RANGE = { from: '2033-04-28', to: '2033-06-01' };

const make = (tx: Tx, title: string, phone: string, sessions: object[]) =>
	createBooking(
		tx,
		bookingSchema.parse({
			newClientName: `E2E CRM Spec Cal ${title}`,
			newClientPhone: phone,
			title,
			eventType: 'wedding',
			agreedPrice: '1000000',
			sessions: JSON.stringify(sessions),
			addons: '[]'
		}),
		null
	);

describe.runIf(isDevDb)('calendar service', () => {
	it('shows booked vs tentative sessions, warns on 2+ bookings a day, hides Batal', () =>
		inRollback(async (tx) => {
			const a = await make(tx, 'E2E Cal A', '0899-7004-0001', [
				{ eventType: 'akad', date: DAY, startTime: '08:00' },
				{ eventType: 'resepsi', date: NEXT, startTime: '19:00' }
			]);
			const b = await make(tx, 'E2E Cal B', '0899-7004-0002', [
				{ eventType: 'resepsi', date: DAY, startTime: '18:00' }
			]);
			const c = await make(tx, 'E2E Cal C', '0899-7004-0003', [
				{ eventType: 'lamaran', date: DAY }
			]);
			// A paid DP (P3-04 will set this from a payment); C is cancelled
			await tx.update(booking).set({ bookedAt: new Date() }).where(eq(booking.id, a.id));
			await tx
				.update(booking)
				.set({ stage: 'lost', lostReason: 'Uji' })
				.where(eq(booking.id, c.id));

			const all = await listCalendar(tx, RANGE);
			const mine = all.items.filter((i) => [a.id, b.id, c.id].includes(i.bookingId));
			expect(mine.map((i) => [i.date, i.title, i.booked])).toEqual([
				[DAY, 'E2E Cal A', true],
				[DAY, 'E2E Cal B', false],
				[NEXT, 'E2E Cal A', true]
			]);
			// A and B on DAY; C is Batal and does not count
			expect(all.busyDays[DAY]).toBe(2);
			expect(all.busyDays[NEXT]).toBeUndefined();

			// Tentative hidden: B goes, the warning stays
			const booked = await listCalendar(tx, { ...RANGE, includeTentative: false });
			expect(booked.items.some((i) => i.bookingId === b.id)).toBe(false);
			expect(booked.items.filter((i) => i.bookingId === a.id)).toHaveLength(2);
			expect(booked.busyDays[DAY]).toBe(2);

			// Session event type filter
			const resepsi = await listCalendar(tx, { ...RANGE, eventType: 'resepsi' });
			expect(
				resepsi.items.filter((i) => [a.id, b.id].includes(i.bookingId)).map((i) => i.eventType)
			).toEqual(['resepsi', 'resepsi']);
		}));
});
