// DB spec for the activity timeline (P2-04). Neon `dev` branch (NEON_BRANCH=dev) or localhost
// only; every case runs in a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { activitySchema, bookingSchema, deliverySchema } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import { booking, user } from '../db/schema/index';
import { addBookingActivity, listActivities } from './activity';
import { createBooking, getBookingDetail, moveBooking, updateDelivery } from './bookings';
import { getClient } from './clients';
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

/** Entries use the app clock; keep them apart so the order is certain (now() is fixed in a tx) */
const tick = () => new Promise((r) => setTimeout(r, 5));

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

const newBooking = (title: string) =>
	bookingSchema.parse({
		newClientName: 'E2E CRM Spec Activity',
		newClientPhone: '0899-7003-0001',
		title,
		eventType: 'wedding',
		agreedPrice: '5000000',
		sessions: JSON.stringify([{ eventType: 'akad', date: '2031-03-01' }]),
		addons: '[]'
	});

describe('activitySchema', () => {
	it('accepts only the manual types and needs a body', () => {
		const id = '00000000-0000-4000-8000-000000000000';
		expect(
			activitySchema.safeParse({ bookingId: id, type: 'note', body: ' Halo ' }).data?.body
		).toBe('Halo');
		expect(
			activitySchema.safeParse({ bookingId: id, type: 'stage_change', body: 'x' }).success
		).toBe(false);
		expect(activitySchema.safeParse({ bookingId: id, type: 'call', body: '   ' }).success).toBe(
			false
		);
	});

	it('delivery link must be http(s); empty fields become null', () => {
		const id = '00000000-0000-4000-8000-000000000000';
		expect(deliverySchema.safeParse({ id, deliveryLink: 'drive.google.com/x' }).success).toBe(
			false
		);
		expect(deliverySchema.parse({ id, deliveryLink: '', rawDeliveredOn: '' })).toEqual({
			id,
			deliveryLink: null,
			rawDeliveredOn: null,
			editedDeliveredOn: null
		});
	});
});

describe.runIf(isDevDb)('activity service', () => {
	it('lists notes and stage changes newest first with their author', () =>
		inRollback(async (tx) => {
			const [me] = await tx.select({ id: user.id, name: user.name }).from(user).limit(1);
			const made = await createBooking(tx, newBooking('E2E CRM Activity A'), me.id);
			await tick();

			await addBookingActivity(
				tx,
				{ bookingId: made.id, type: 'note', body: 'Kirim pricelist' },
				me.id
			);
			await tick();
			await moveBooking(
				tx,
				{
					id: made.id,
					to: 'consultation',
					beforeId: null,
					afterId: null,
					lostReason: null,
					confirmBalance: false
				},
				me.id
			);
			await tick();
			await addBookingActivity(
				tx,
				{ bookingId: made.id, type: 'call', body: 'Telepon konfirmasi' },
				null
			);

			const items = await listActivities(tx, { bookingId: made.id });
			expect(items.map((a) => a.type)).toEqual(['call', 'stage_change', 'note', 'system']);
			expect(items[1].meta).toEqual({ from: 'inquiry', to: 'consultation' });
			expect(items[1].userName).toBe(me.name);
			expect(items[2]).toMatchObject({ body: 'Kirim pricelist', userName: me.name });
			// No author = system / website form
			expect(items[0].userName).toBeNull();
			for (let i = 1; i < items.length; i++)
				expect(+items[i - 1].occurredAt).toBeGreaterThanOrEqual(+items[i].occurredAt);

			// The client timeline holds the booking's entries too, with the booking title
			const c = await getClient(tx, made.clientId);
			const forBooking = c!.activities.filter((a) => a.bookingId === made.id);
			expect(forBooking).toHaveLength(4);
			expect(forBooking[0].bookingTitle).toBe('E2E CRM Activity A');
		}));

	it('refuses an unknown booking', () =>
		inRollback(async (tx) => {
			const e = await addBookingActivity(
				tx,
				{ bookingId: '00000000-0000-4000-8000-000000000000', type: 'note', body: 'x' },
				null
			).catch((err: unknown) => err);
			expect(e).toBeInstanceOf(ServiceError);
		}));

	it('booking detail carries sessions, client and delivery fields', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, newBooking('E2E CRM Activity B'), null);
			await updateDelivery(tx, {
				id: made.id,
				deliveryLink: 'https://drive.google.com/x',
				rawDeliveredOn: '2031-03-10',
				editedDeliveredOn: null
			});
			const d = await getBookingDetail(tx, made.id);
			expect(d).toMatchObject({
				title: 'E2E CRM Activity B',
				firstDate: '2031-03-01',
				deliveryLink: 'https://drive.google.com/x',
				rawDeliveredOn: '2031-03-10',
				editedDeliveredOn: null,
				client: { name: 'E2E CRM Spec Activity', phone: '6289970030001' }
			});
			expect(d!.sessions).toHaveLength(1);
			const [row] = await tx.select().from(booking).where(eq(booking.id, made.id));
			expect(row.deliveryLink).toBe('https://drive.google.com/x');
		}));
});
