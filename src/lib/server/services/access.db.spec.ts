// DB spec for access control (P0-05). Neon `dev` branch (NEON_BRANCH=dev) or localhost only;
// everything runs in a transaction that is rolled back.
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { can } from '../../permissions';
import { createDb, type Tx } from '../db/client';
import { rolePermission, session, user } from '../db/schema/index';
import {
	createRole,
	deleteRole,
	loadPermissions,
	setRolePermissions,
	setUserActive,
	setUserRoles
} from './access';
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

const mail = () => `spec-${randomUUID()}@naburmoment.test`;
const password = 'rahasia-123';

describe.runIf(isDevDb)('access control', () => {
	it('gives a user the union of their roles; changes apply on the next load', () =>
		inRollback(async (tx) => {
			const u = await createUser(tx, { name: 'Staf', email: mail(), password });
			const finance = await createRole(tx, { name: `Keuangan ${randomUUID()}` });
			const content = await createRole(tx, { name: `Konten ${randomUUID()}` });
			await setRolePermissions(tx, finance.id, [{ module: 'invoices', action: 'create' }]);
			await setRolePermissions(tx, content.id, [{ module: 'cms_faq', action: 'update' }]);

			expect((await loadPermissions(tx, { id: u.id, isOwner: false })).size).toBe(0);

			await setUserRoles(tx, u.id, [finance.id, content.id]);
			const perms = await loadPermissions(tx, { id: u.id, isOwner: false });
			expect(can(perms, 'invoices', 'create')).toBe(true);
			expect(can(perms, 'invoices', 'read')).toBe(true);
			expect(can(perms, 'cms_faq', 'update')).toBe(true);
			expect(can(perms, 'invoices', 'delete')).toBe(false);
			expect(can(perms, 'access', 'read')).toBe(false);

			await setUserRoles(tx, u.id, [content.id]);
			const after = await loadPermissions(tx, { id: u.id, isOwner: false });
			expect(can(after, 'invoices', 'read')).toBe(false);
		}));

	it('stores C/U/D with R and never stores access', () =>
		inRollback(async (tx) => {
			const r = await createRole(tx, { name: `Peran ${randomUUID()}` });
			await setRolePermissions(tx, r.id, [
				{ module: 'expenses', action: 'delete' },
				{ module: 'access', action: 'read' }
			]);
			const rows = await tx
				.select({ module: rolePermission.module, action: rolePermission.action })
				.from(rolePermission)
				.where(eq(rolePermission.roleId, r.id));
			expect(rows.map((x) => `${x.module}:${x.action}`).sort()).toEqual([
				'expenses:delete',
				'expenses:read'
			]);
			// The database refuses it too
			await expect(
				tx.transaction((sp) =>
					sp.insert(rolePermission).values({ roleId: r.id, module: 'access', action: 'read' })
				)
			).rejects.toThrow();
		}));

	it('refuses to delete a role that is still assigned', () =>
		inRollback(async (tx) => {
			const u = await createUser(tx, { name: 'Staf', email: mail(), password });
			const r = await createRole(tx, { name: `Peran ${randomUUID()}` });
			await setUserRoles(tx, u.id, [r.id]);
			await expect(deleteRole(tx, r.id)).rejects.toBeInstanceOf(ServiceError);
			await setUserRoles(tx, u.id, []);
			await deleteRole(tx, r.id);
		}));

	it('refuses a duplicate role name', () =>
		inRollback(async (tx) => {
			const name = `Peran ${randomUUID()}`;
			await createRole(tx, { name });
			await expect(createRole(tx, { name: `  ${name} ` })).rejects.toBeInstanceOf(ServiceError);
		}));

	it('never deactivates the owner; deactivating others ends their sessions', () =>
		inRollback(async (tx) => {
			await tx.update(user).set({ isOwner: false });
			const owner = await createUser(tx, {
				name: 'Pemilik',
				email: mail(),
				password,
				isOwner: true
			});
			await expect(setUserActive(tx, owner.id, false)).rejects.toBeInstanceOf(ServiceError);

			const staff = await createUser(tx, { name: 'Staf', email: mail(), password });
			await tx.insert(session).values({
				id: randomUUID(),
				token: randomUUID(),
				userId: staff.id,
				expiresAt: new Date(Date.now() + 86_400_000),
				updatedAt: new Date()
			});
			await setUserActive(tx, staff.id, false);
			const left = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(session)
				.where(eq(session.userId, staff.id));
			expect(left[0].n).toBe(0);
			const [row] = await tx
				.select({ active: user.active })
				.from(user)
				.where(eq(user.id, staff.id));
			expect(row.active).toBe(false);
		}));

	it('keeps exactly one owner, whatever roles they hold', () =>
		inRollback(async (tx) => {
			await tx.update(user).set({ isOwner: false });
			const owner = await createUser(tx, {
				name: 'Pemilik',
				email: mail(),
				password,
				isOwner: true
			});
			await expect(
				createUser(tx, { name: 'Kedua', email: mail(), password, isOwner: true })
			).rejects.toBeInstanceOf(ServiceError);
			// Roles do not demote: the owner keeps every permission with no roles at all
			await setUserRoles(tx, owner.id, []);
			const perms = await loadPermissions(tx, { id: owner.id, isOwner: true });
			expect(can(perms, 'access', 'delete')).toBe(true);
			const [row] = await tx
				.select({ isOwner: user.isOwner })
				.from(user)
				.where(eq(user.id, owner.id));
			expect(row.isOwner).toBe(true);
		}));
});
