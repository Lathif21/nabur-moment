// Admin logins. Relative imports only: scripts/create-user.ts uses this too. Public sign-up is off;
// the owner adds people in Akses & Peran → Pengguna (P0-06) or with the script.
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { account, user } from '../db/schema/index.ts';
import { ServiceError } from './errors.ts';

export const MIN_PASSWORD = 8;

/** A readable random password (16 characters, URL-safe) */
export function generatePassword() {
	return randomBytes(12).toString('base64url');
}

/**
 * A new login (email + password, the same rows Better Auth writes). Returns the password so a
 * generated one can be shown once. `isOwner` is for the script only: there is exactly one owner.
 */
export async function createUser(
	db: DbOrTx,
	input: { name: string; email: string; password?: string; isOwner?: boolean; active?: boolean }
) {
	const email = input.email.trim().toLowerCase();
	const name = input.name.trim();
	if (!email || !name) throw new ServiceError('Nama dan email wajib diisi.');
	const password = input.password || generatePassword();
	if (password.length < MIN_PASSWORD)
		throw new ServiceError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`, 'password');

	return db.transaction(async (tx) => {
		const [existing] = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
		if (existing) throw new ServiceError('Email ini sudah dipakai pengguna lain.', 'email');
		if (input.isOwner) {
			const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.isOwner, true));
			if (owner) throw new ServiceError('Pemilik sudah ada. Hanya boleh satu pemilik.');
		}
		const id = randomUUID();
		await tx.insert(user).values({
			id,
			email,
			name,
			emailVerified: true,
			isOwner: input.isOwner ?? false,
			active: input.active ?? true
		});
		await tx.insert(account).values({
			id: randomUUID(),
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: await hashPassword(password)
		});
		return { id, email, password, generated: !input.password };
	});
}

/** Whether a user may hold a session (exists and is active) */
export async function isActiveUser(db: DbOrTx, userId: string) {
	const [row] = await db.select({ active: user.active }).from(user).where(eq(user.id, userId));
	return row?.active === true;
}
