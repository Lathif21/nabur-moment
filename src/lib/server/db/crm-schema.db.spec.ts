// DB spec for the CRM schema (P2-01): the checks that guard bookings at the database level.
// Neon `dev` branch (NEON_BRANCH=dev) or localhost only; every case runs in a rolled-back transaction.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, type Tx } from './client';
import { booking, bookingAddon, bookingSession, client, leadSource } from './schema/index';

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

/** Runs `fn` inside a savepoint and returns the Postgres constraint name it violated */
async function violation(tx: Tx, fn: (tx: Tx) => Promise<unknown>): Promise<string | undefined> {
	try {
		await tx.transaction(async (sp) => {
			await fn(sp);
		});
		return undefined;
	} catch (e) {
		const cause =
			(e as { cause?: { constraint?: string } }).cause ?? (e as { constraint?: string });
		return cause.constraint;
	}
}

async function newClient(tx: Tx, name = 'E2E CRM Spec Klien') {
	const [c] = await tx.insert(client).values({ name, phone: '6289900000001' }).returning();
	return c;
}

describe.runIf(isDevDb)('CRM schema', () => {
	it('seeds the dummy lead sources', () =>
		inRollback(async (tx) => {
			const names = (await tx.select({ name: leadSource.name }).from(leadSource)).map(
				(s) => s.name
			);
			expect(names).toEqual(
				expect.arrayContaining([
					'Instagram',
					'TikTok',
					'Referral',
					'Website',
					'WhatsApp',
					'Vendor partner',
					'Lainnya'
				])
			);
		}));

	it('refuses booked-or-later stages without booked_at (DP paid)', () =>
		inRollback(async (tx) => {
			const c = await newClient(tx);
			const base = {
				clientId: c.id,
				title: 'E2E CRM',
				eventType: 'wedding' as const,
				position: 'a0'
			};
			for (const stage of ['booked', 'preparation', 'event_day', 'editing', 'completed'] as const) {
				expect(await violation(tx, (t) => t.insert(booking).values({ ...base, stage }))).toBe(
					'booking_booked_needs_dp'
				);
			}
			expect(
				await violation(tx, (t) =>
					t.insert(booking).values({ ...base, stage: 'booked', bookedAt: new Date() })
				)
			).toBeUndefined();
			expect(
				await violation(tx, (t) => t.insert(booking).values({ ...base, stage: 'quotation' }))
			).toBeUndefined();
		}));

	it('refuses lost without a reason', () =>
		inRollback(async (tx) => {
			const c = await newClient(tx);
			const base = {
				clientId: c.id,
				title: 'E2E CRM',
				eventType: 'wedding' as const,
				position: 'a0',
				stage: 'lost' as const
			};
			expect(await violation(tx, (t) => t.insert(booking).values(base))).toBe(
				'booking_lost_needs_reason'
			);
			expect(
				await violation(tx, (t) => t.insert(booking).values({ ...base, lostReason: '  ' }))
			).toBe('booking_lost_needs_reason');
			expect(
				await violation(tx, (t) => t.insert(booking).values({ ...base, lostReason: 'Batal' }))
			).toBeUndefined();
		}));

	it('validates session times and add-on quantity; deleting a booking removes its rows', () =>
		inRollback(async (tx) => {
			const c = await newClient(tx);
			const [b] = await tx
				.insert(booking)
				.values({ clientId: c.id, title: 'E2E CRM', eventType: 'wedding', position: 'a0' })
				.returning();
			expect(
				await violation(tx, (t) =>
					t
						.insert(bookingSession)
						.values({ bookingId: b.id, eventType: 'akad', startTime: '25:00' })
				)
			).toBe('booking_session_time_format');
			expect(
				await violation(tx, (t) =>
					t.insert(bookingAddon).values({ bookingId: b.id, name: 'X', unitPrice: 1, qty: 0 })
				)
			).toBe('booking_addon_qty_min');

			await tx
				.insert(bookingSession)
				.values({ bookingId: b.id, eventType: 'akad', date: '2027-01-10', startTime: '08:30' });
			await tx.delete(booking).where(sql`${booking.id} = ${b.id}`);
			const left = await tx
				.select()
				.from(bookingSession)
				.where(sql`${bookingSession.bookingId} = ${b.id}`);
			expect(left).toHaveLength(0);
		}));

	it('finds clients by a partial name (trigram index)', () =>
		inRollback(async (tx) => {
			await newClient(tx, 'E2E CRM Kirana Wulandari');
			const rows = await tx
				.select({ name: client.name })
				.from(client)
				.where(sql`${client.name} ilike ${'%wuland%'}`);
			expect(rows.map((r) => r.name)).toContain('E2E CRM Kirana Wulandari');
		}));
});
