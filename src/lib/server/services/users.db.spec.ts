// DB spec for logins (P0-03): sign-up impossible, inactive users refused, exactly one owner.
// Runs only against the Neon `dev` branch (NEON_BRANCH=dev) or localhost; leaves no rows behind.
import { randomUUID } from 'node:crypto';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createAuth } from '../auth-config';
import { createDb, type Tx } from '../db/client';
import { user } from '../db/schema/index';
import { ServiceError } from './errors';
import { createUser } from './users';

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

describe.runIf(isDevDb)('logins', () => {
	const db = createDb(url!);
	const auth = createAuth(db, {
		baseURL: 'http://localhost:5173',
		secret: 'test-secret-for-db-specs-only-0123456789'
	});
	const created: string[] = [];
	const password = 'rahasia-123';

	async function make(active: boolean) {
		const email = `spec-${randomUUID()}@naburmoment.test`;
		const u = await createUser(db, { name: 'Spec', email, password, active });
		created.push(u.id);
		return email;
	}

	afterAll(async () => {
		if (created.length) await db.delete(user).where(inArray(user.id, created));
		await db.$client.end();
	});

	it('an active user signs in with the right password only', async () => {
		const email = await make(true);
		const res = await auth.api.signInEmail({ body: { email, password } });
		expect(res.token).toBeTruthy();
		await expect(
			auth.api.signInEmail({ body: { email, password: 'salah-sekali' } })
		).rejects.toMatchObject({ status: 'UNAUTHORIZED' });
	});

	it('an inactive user is refused even with the right password', async () => {
		const email = await make(false);
		await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toMatchObject({
			status: 'FORBIDDEN'
		});
	});

	it('sign-up is impossible', async () => {
		const email = `spec-${randomUUID()}@naburmoment.test`;
		await expect(
			auth.api.signUpEmail({ body: { email, password, name: 'Penyusup' } })
		).rejects.toBeTruthy();
		const rows = await db
			.select({ id: user.id })
			.from(user)
			.where(sql`${user.email} = ${email}`);
		expect(rows).toHaveLength(0);
	});

	it('refuses a duplicate email', async () => {
		const email = await make(true);
		await expect(createUser(db, { name: 'Lagi', email, password })).rejects.toBeInstanceOf(
			ServiceError
		);
	});

	it('allows exactly one owner (service and database)', async () => {
		await expect(
			db.transaction(async (tx: Tx) => {
				// Start from "no owner" so the spec works whether or not dev has one
				await tx.update(user).set({ isOwner: false });
				const mail = () => `spec-${randomUUID()}@naburmoment.test`;
				await createUser(tx, { name: 'Pemilik', email: mail(), password, isOwner: true });
				await expect(
					createUser(tx, { name: 'Kedua', email: mail(), password, isOwner: true })
				).rejects.toBeInstanceOf(ServiceError);
				// The partial unique index blocks a second owner even past the service
				await expect(
					tx.transaction((sp) =>
						sp
							.update(user)
							.set({ isOwner: true })
							.where(sql`not ${user.isOwner}`)
					)
				).rejects.toThrow();
				throw new Rollback();
			})
		).rejects.toBeInstanceOf(Rollback);
	});
});
