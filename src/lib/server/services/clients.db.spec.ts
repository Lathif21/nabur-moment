// DB spec for clients (P2-02). Neon `dev` branch (NEON_BRANCH=dev) or localhost only;
// every case runs in a transaction that is rolled back.
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { clientSchema } from '../../schemas/crm';
import { createDb, type Tx } from '../db/client';
import { booking, bookingSession } from '../db/schema/index';
import {
	createClient,
	findClientByPhone,
	getClient,
	listClients,
	listLeadSources,
	setClientArchived,
	updateClient
} from './clients';
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

/** Unlikely to collide with seed data: 0899 7xx… */
const input = (over: Record<string, string> = {}) =>
	clientSchema.parse({ name: 'E2E CRM Spec Anindya', phone: '0899-7001-2345', ...over });

describe('clientSchema', () => {
	it('normalises WhatsApp, Instagram and empty fields', () => {
		const v = clientSchema.parse({
			name: '  Anindya ',
			phone: '0812 3456 7890',
			instagram: 'https://www.instagram.com/anindya.ws/',
			email: ' A@Mail.COM ',
			city: ''
		});
		expect(v).toMatchObject({
			name: 'Anindya',
			phone: '6281234567890',
			instagram: 'anindya.ws',
			email: 'a@mail.com',
			city: null,
			sourceId: null
		});
	});

	it('rejects a bad phone, email or handle with Indonesian messages', () => {
		const r = clientSchema.safeParse({ name: 'X', phone: '12', email: 'x@', instagram: 'a b' });
		expect(r.success).toBe(false);
		const fields = r.error!.issues.map((i) => i.path[0]);
		expect(fields).toEqual(expect.arrayContaining(['phone', 'email', 'instagram']));
	});
});

describe.runIf(isDevDb)('clients service', () => {
	it('creates a client with a "Klien ditambahkan" activity and refuses a duplicate WhatsApp', () =>
		inRollback(async (tx) => {
			const { id } = await createClient(tx, input(), null);
			const found = await getClient(tx, id);
			expect(found?.client.phone).toBe('6289970012345');
			expect(found?.activities.map((a) => a.body)).toContain('Klien ditambahkan');

			const dup = createClient(tx, input({ name: 'Lain', phone: '+62 899 7001 2345' }), null);
			await expect(dup).rejects.toThrow(ServiceError);
			await expect(dup).rejects.toMatchObject({ field: 'phone' });
			expect((await findClientByPhone(tx, '6289970012345'))?.id).toBe(id);
		}));

	it('updates, keeping its own number, but not onto another client’s number', () =>
		inRollback(async (tx) => {
			const a = await createClient(tx, input(), null);
			const b = await createClient(tx, input({ name: 'E2E CRM B', phone: '0899-7001-9999' }), null);
			await updateClient(tx, a.id, input({ city: 'Bandung' }));
			expect((await getClient(tx, a.id))?.client.city).toBe('Bandung');
			await expect(updateClient(tx, b.id, input({ name: 'E2E CRM B' }))).rejects.toMatchObject({
				field: 'phone'
			});
		}));

	it('searches by name, local phone digits and Instagram; filters by source and archive', () =>
		inRollback(async (tx) => {
			const [src] = await listLeadSources(tx);
			const { id } = await createClient(
				tx,
				input({ instagram: '@anindya.e2e', sourceId: src.id }),
				null
			);
			const ids = async (f: Parameters<typeof listClients>[1]) =>
				(await listClients(tx, f)).map((c) => c.id);

			expect(await ids({ q: 'spec anin' })).toContain(id);
			expect(await ids({ q: '0899 7001' })).toContain(id);
			expect(await ids({ q: '@anindya.e2e' })).toContain(id);
			expect(await ids({ q: 'tidak-ada-yang-cocok-xyz' })).not.toContain(id);
			expect(await ids({ sourceId: src.id })).toContain(id);

			await setClientArchived(tx, id, true);
			expect(await ids({ q: 'spec anin' })).not.toContain(id);
			expect(await ids({ q: 'spec anin', archived: true })).toContain(id);
			await setClientArchived(tx, id, false);
			expect(await ids({ q: 'spec anin' })).toContain(id);
		}));

	it('totals the value of bookings that are not lost', () =>
		inRollback(async (tx) => {
			const { id } = await createClient(tx, input(), null);
			const base = { clientId: id, eventType: 'wedding' as const, position: 'a0' };
			await tx.insert(booking).values([
				{ ...base, title: 'A', agreedPrice: 5_000_000 },
				{ ...base, title: 'B', agreedPrice: 3_000_000, stage: 'lost', lostReason: 'Batal' }
			]);
			const [a] = await tx
				.select({ id: booking.id })
				.from(booking)
				.where(and(eq(booking.clientId, id), eq(booking.title, 'A')));
			await tx.insert(bookingSession).values([
				{ bookingId: a.id, eventType: 'resepsi', date: '2027-03-14' },
				{ bookingId: a.id, eventType: 'akad', date: '2027-03-13' },
				{ bookingId: a.id, eventType: 'other', date: null }
			]);
			const found = await getClient(tx, id);
			expect(found?.bookings).toHaveLength(2);
			// Hari H = earliest dated session
			expect(found?.bookings.find((b) => b.title === 'A')?.firstDate).toBe('2027-03-13');
			expect(found?.bookings.find((b) => b.title === 'B')?.firstDate).toBeNull();
			expect(found?.totals).toEqual({ value: 5_000_000, paid: 0, outstanding: 5_000_000 });
			expect((await listClients(tx, { q: 'spec anin' })).find((c) => c.id === id)?.bookings).toBe(
				2
			);
		}));
});
