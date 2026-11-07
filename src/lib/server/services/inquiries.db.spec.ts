// P1-08: two submissions with the same WhatsApp at the same moment still make one client.
// Runs on NEON_BRANCH=dev with real commits (two connections); cleans up after itself.
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { booking, client } from '../db/schema/index';
import { submitInquiry } from './inquiries';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const isDevDb = !!url && process.env.NEON_BRANCH === 'dev';
const phone = `62819${String(Date.now()).slice(-8)}`;

const input = {
	name: 'Spec Inquiry',
	phone,
	email: null,
	instagram: null,
	eventType: 'lamaran',
	eventDate: null,
	venue: null,
	city: null,
	packageId: null,
	sourceId: null,
	message: 'spec'
};

describe.runIf(isDevDb)('submitInquiry', () => {
	afterAll(async () => {
		const db = createDb(url!);
		try {
			const ids = (
				await db.select({ id: client.id }).from(client).where(eq(client.phone, phone))
			).map((c) => c.id);
			if (ids.length) {
				await db.delete(booking).where(inArray(booking.clientId, ids));
				await db.delete(client).where(inArray(client.id, ids));
			}
		} finally {
			await db.$client.end();
		}
	});

	it('serialises concurrent submissions for the same number', async () => {
		const a = createDb(url!);
		const b = createDb(url!);
		try {
			const [x, y] = await Promise.all([submitInquiry(a, input), submitInquiry(b, input)]);
			expect(x.clientId).toBe(y.clientId);
			expect([x.newClient, y.newClient].filter(Boolean)).toHaveLength(1);
			const bookings = await a.select().from(booking).where(eq(booking.clientId, x.clientId));
			expect(bookings).toHaveLength(2);
		} finally {
			await a.$client.end();
			await b.$client.end();
		}
	});
});
