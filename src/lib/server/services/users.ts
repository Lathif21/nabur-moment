// Admin logins. Relative imports only: scripts/create-user.ts uses this too. Public sign-up is off;
// the owner adds people in Akses & Peran → Pengguna (P0-06) or with the script.
import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { account, role, session, user, userRole } from '../db/schema/index.ts';
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

/** Akses & Peran → Pengguna: owner first, then by name; each with their roles */
export async function listUsers(db: DbOrTx) {
	const [rows, links] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				isOwner: user.isOwner,
				active: user.active,
				createdAt: user.createdAt
			})
			.from(user)
			.orderBy(desc(user.isOwner), asc(user.name)),
		db
			.select({ userId: userRole.userId, id: role.id, name: role.name })
			.from(userRole)
			.innerJoin(role, eq(role.id, userRole.roleId))
			.orderBy(asc(role.name))
	]);
	return rows.map((u) => ({
		...u,
		roles: links.filter((l) => l.userId === u.id).map(({ id, name }) => ({ id, name }))
	}));
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];

/**
 * New password for a user (generated when empty). Their open sessions end, so the old password
 * cannot linger on another device. Returns the password so a generated one can be shown once.
 */
export async function resetPassword(db: DbOrTx, userId: string, newPassword?: string) {
	const password = newPassword || generatePassword();
	if (password.length < MIN_PASSWORD)
		throw new ServiceError(`Kata sandi minimal ${MIN_PASSWORD} karakter.`, 'password');
	const hash = await hashPassword(password);
	return db.transaction(async (tx) => {
		const [u] = await tx
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId));
		if (!u) throw new ServiceError('Pengguna tidak ditemukan.');
		const updated = await tx
			.update(account)
			.set({ password: hash })
			.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
			.returning({ id: account.id });
		if (!updated.length) {
			await tx.insert(account).values({
				id: randomUUID(),
				userId,
				accountId: userId,
				providerId: 'credential',
				password: hash
			});
		}
		await tx.delete(session).where(eq(session.userId, userId));
		return { name: u.name, email: u.email, password, generated: !newPassword };
	});
}
