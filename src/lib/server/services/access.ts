// Roles, permissions and the owner rules (docs/04-ARCHITECTURE.md → Access control). The Akses &
// Peran screens (P0-06) call these; only the owner reaches them. Relative imports only.
import { and, asc, count, eq, inArray, ne } from 'drizzle-orm';
import {
	type CrudAction,
	normalizeGrants,
	type Permission,
	permissionSet
} from '../../permissions.ts';
import type { DbOrTx } from '../db/client.ts';
import { role, rolePermission, session, user, userRole } from '../db/schema/index.ts';
import { ServiceError } from './errors.ts';
import { createUser } from './users.ts';

/** The permission set of one user (owner = everything). Loaded once per admin request. */
export async function loadPermissions(
	db: DbOrTx,
	u: { id: string; isOwner: boolean }
): Promise<Set<Permission>> {
	if (u.isOwner) return permissionSet([], true);
	const rows = await db
		.select({ module: rolePermission.module, action: rolePermission.action })
		.from(userRole)
		.innerJoin(rolePermission, eq(rolePermission.roleId, userRole.roleId))
		.where(eq(userRole.userId, u.id));
	return permissionSet(rows, false);
}

/* ---------- Roles ---------- */

export function listRoles(db: DbOrTx) {
	return db
		.select({
			id: role.id,
			name: role.name,
			description: role.description,
			users: db.$count(userRole, eq(userRole.roleId, role.id))
		})
		.from(role)
		.orderBy(asc(role.name));
}

export async function getRole(db: DbOrTx, id: string) {
	const [r] = await db.select().from(role).where(eq(role.id, id));
	if (!r) throw new ServiceError('Peran tidak ditemukan.');
	const grants = await db
		.select({ module: rolePermission.module, action: rolePermission.action })
		.from(rolePermission)
		.where(eq(rolePermission.roleId, id));
	return { ...r, grants };
}

async function assertNameFree(db: DbOrTx, name: string, exceptId?: string) {
	const [clash] = await db
		.select({ id: role.id })
		.from(role)
		.where(exceptId ? and(eq(role.name, name), ne(role.id, exceptId)) : eq(role.name, name));
	if (clash) throw new ServiceError('Nama peran ini sudah dipakai.', 'name');
}

export async function createRole(db: DbOrTx, input: { name: string; description?: string }) {
	const name = input.name.trim();
	if (!name) throw new ServiceError('Nama peran wajib diisi.', 'name');
	await assertNameFree(db, name);
	const [r] = await db
		.insert(role)
		.values({ name, description: input.description?.trim() || null })
		.returning({ id: role.id });
	return r;
}

export async function updateRole(
	db: DbOrTx,
	id: string,
	input: { name: string; description?: string }
) {
	const name = input.name.trim();
	if (!name) throw new ServiceError('Nama peran wajib diisi.', 'name');
	await assertNameFree(db, name, id);
	const done = await db
		.update(role)
		.set({ name, description: input.description?.trim() || null })
		.where(eq(role.id, id))
		.returning({ id: role.id });
	if (!done.length) throw new ServiceError('Peran tidak ditemukan.');
}

/** Refused while any user holds the role */
export async function deleteRole(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		const [{ n }] = await tx.select({ n: count() }).from(userRole).where(eq(userRole.roleId, id));
		if (n > 0)
			throw new ServiceError(
				`Peran ini masih dipakai ${n} pengguna. Lepaskan dulu dari pengguna tersebut.`
			);
		const done = await tx.delete(role).where(eq(role.id, id)).returning({ id: role.id });
		if (!done.length) throw new ServiceError('Peran tidak ditemukan.');
	});
}

/** Replaces a role's matrix. Unknown / owner-only ticks are dropped; C/U/D adds R. */
export async function setRolePermissions(
	db: DbOrTx,
	roleId: string,
	grants: { module: string; action: CrudAction }[]
) {
	const rows = normalizeGrants(grants).map((g) => ({ roleId, ...g }));
	return db.transaction(async (tx) => {
		const [r] = await tx.select({ id: role.id }).from(role).where(eq(role.id, roleId));
		if (!r) throw new ServiceError('Peran tidak ditemukan.');
		await tx.delete(rolePermission).where(eq(rolePermission.roleId, roleId));
		if (rows.length) await tx.insert(rolePermission).values(rows);
		return rows;
	});
}

/* ---------- Users ---------- */

async function getUser(db: DbOrTx, id: string) {
	const [u] = await db
		.select({ id: user.id, isOwner: user.isOwner, active: user.active })
		.from(user)
		.where(eq(user.id, id));
	if (!u) throw new ServiceError('Pengguna tidak ditemukan.');
	return u;
}

/** Replaces a user's roles. Changes apply on their next request (permissions load per request). */
export async function setUserRoles(db: DbOrTx, userId: string, roleIds: string[]) {
	const ids = [...new Set(roleIds)];
	return db.transaction(async (tx) => {
		await getUser(tx, userId);
		if (ids.length) {
			const found = await tx.select({ id: role.id }).from(role).where(inArray(role.id, ids));
			if (found.length !== ids.length) throw new ServiceError('Ada peran yang tidak ditemukan.');
		}
		await tx.delete(userRole).where(eq(userRole.userId, userId));
		if (ids.length) await tx.insert(userRole).values(ids.map((roleId) => ({ userId, roleId })));
	});
}

/** Deactivating ends every open session at once. The owner can never be deactivated. */
export async function setUserActive(db: DbOrTx, userId: string, active: boolean) {
	return db.transaction(async (tx) => {
		const u = await getUser(tx, userId);
		if (u.isOwner && !active) throw new ServiceError('Akun pemilik tidak bisa dinonaktifkan.');
		await tx.update(user).set({ active }).where(eq(user.id, userId));
		if (!active) await tx.delete(session).where(eq(session.userId, userId));
	});
}

/*
 * Ownership never moves in the app (Q20): there is deliberately no service that sets or clears
 * `is_owner`, and users are deactivated, not deleted. Changing the owner is a script-only
 * operation on the database.
 */

/** Akses & Peran → Tambah pengguna: the login and its roles in one transaction */
export async function addUser(
	db: DbOrTx,
	input: { name: string; email: string; password?: string; roleIds: string[] }
) {
	return db.transaction(async (tx) => {
		const made = await createUser(tx, input);
		await setUserRoles(tx, made.id, input.roleIds);
		return made;
	});
}

/** Role editor "Simpan": name, description and matrix together */
export async function saveRole(
	db: DbOrTx,
	id: string,
	input: { name: string; description?: string; grants: { module: string; action: CrudAction }[] }
) {
	return db.transaction(async (tx) => {
		await updateRole(tx, id, input);
		return setRolePermissions(tx, id, input.grants);
	});
}
