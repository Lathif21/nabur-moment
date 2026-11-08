// DB spec for the payment schedule (P3-01). Neon `dev` branch (NEON_BRANCH=dev) or localhost
// only; every case runs in a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import { booking, client } from '../db/schema/index';
import { createBooking, createInquiryBooking, moveBooking, updateBooking } from './bookings';
import { ServiceError } from './errors';
import { listSchedule } from './installments';

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

const AKAD = '2031-06-06';
const RESEPSI = '2031-06-07';

const input = (over: Record<string, unknown> = {}) =>
	bookingSchema.parse({
		newClientName: 'E2E CRM Spec Schedule',
		newClientPhone: '0899-7005-0001',
		title: 'E2E CRM Schedule',
		eventType: 'wedding',
		agreedPrice: '10000000',
		sessions: JSON.stringify([
			{ eventType: 'resepsi', date: RESEPSI },
			{ eventType: 'akad', date: AKAD }
		]),
		addons: '[]',
		...over
	});

const move = (id: string, to: string, lostReason: string | null = null) => ({
	id,
	to: to as never,
	beforeId: null,
	afterId: null,
	lostReason,
	confirmBalance: false
});

const brief = async (tx: Tx, id: string) =>
	(await listSchedule(tx, id)).map((r) => ({
		kind: r.kind,
		amount: r.amount,
		dueDate: r.dueDate,
		cancelled: r.cancelledAt !== null
	}));

describe.runIf(isDevDb)('payment schedule', () => {
	it('Rp 10.000.000 → DP 5.000.000 + Pelunasan 5.000.000 due on the first session; moving the session moves it', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, input(), null);
			expect(await brief(tx, made.id)).toEqual([
				{ kind: 'dp', amount: 5_000_000, dueDate: null, cancelled: false },
				{ kind: 'pelunasan', amount: 5_000_000, dueDate: AKAD, cancelled: false }
			]);

			// The akad moves after the resepsi: Hari H is now the resepsi date
			await updateBooking(
				tx,
				made.id,
				input({
					clientId: made.clientId,
					newClientName: '',
					newClientPhone: '',
					sessions: JSON.stringify([
						{ eventType: 'resepsi', date: RESEPSI },
						{ eventType: 'akad', date: '2031-06-20' }
					])
				}),
				null
			);
			const [, pelunasan] = await brief(tx, made.id);
			expect(pelunasan.dueDate).toBe(RESEPSI);
		}));

	it('recalculates the DP while unpaid; after the DP is paid only the pelunasan changes', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, input(), null);
			const edit = (agreedPrice: string) =>
				updateBooking(
					tx,
					made.id,
					input({ clientId: made.clientId, newClientName: '', newClientPhone: '', agreedPrice }),
					null
				);

			await edit('12000001');
			expect((await brief(tx, made.id)).map((r) => r.amount)).toEqual([6_000_000, 6_000_001]);

			// DP paid (P3-04 sets booked_at from the payment)
			await tx.update(booking).set({ bookedAt: new Date() }).where(eq(booking.id, made.id));
			await edit('15000000');
			expect((await brief(tx, made.id)).map((r) => r.amount)).toEqual([6_000_000, 9_000_000]);

			// Below the paid DP: refused, nothing changes
			const e = await edit('5000000').catch((err: unknown) => err);
			expect(e).toBeInstanceOf(ServiceError);
			expect((e as ServiceError).field).toBe('agreedPrice');
		}));

	it('Batal cancels the pelunasan and keeps the DP; leaving Batal restores it', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, input(), null);
			await moveBooking(tx, move(made.id, 'lost', 'Pindah tanggal'), null);
			expect(await brief(tx, made.id)).toEqual([
				{ kind: 'dp', amount: 5_000_000, dueDate: null, cancelled: false },
				{ kind: 'pelunasan', amount: 5_000_000, dueDate: AKAD, cancelled: true }
			]);
			await moveBooking(tx, move(made.id, 'inquiry'), null);
			expect((await brief(tx, made.id))[1].cancelled).toBe(false);
		}));

	it('a website inquiry gets a schedule too (no date yet → no due date)', () =>
		inRollback(async (tx) => {
			const [c] = await tx
				.insert(client)
				.values({ name: 'E2E CRM Spec Schedule Inquiry', phone: '6289970050002' })
				.returning();
			const made = await createInquiryBooking(tx, {
				clientId: c.id,
				title: 'E2E CRM Schedule Inquiry',
				eventType: 'wedding'
			});
			expect(await brief(tx, made.id)).toEqual([
				{ kind: 'dp', amount: 0, dueDate: null, cancelled: false },
				{ kind: 'pelunasan', amount: 0, dueDate: null, cancelled: false }
			]);
		}));
});
