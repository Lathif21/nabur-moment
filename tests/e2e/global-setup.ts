// Makes sure the limited e2e user exists on the Neon `dev` branch: "staf@naburmoment.test" with
// one role that can only read Klien. Runs only when NEON_BRANCH=dev (never against production).
import { eq } from 'drizzle-orm';
import { createDb } from '../../src/lib/server/db/client.ts';
import { role, user } from '../../src/lib/server/db/schema/index.ts';
import {
	createRole,
	setRolePermissions,
	setUserActive,
	setUserRoles
} from '../../src/lib/server/services/access.ts';
import { createUser } from '../../src/lib/server/services/users.ts';

export const STAFF_EMAIL = 'staf@naburmoment.test';
export const STAFF_PASSWORD = 'staf-rahasia-123';
const ROLE_NAME = 'E2E Klien (lihat saja)';

export default async function globalSetup() {
	try {
		process.loadEnvFile();
	} catch {
		// no .env
	}
	if (process.env.NEON_BRANCH !== 'dev' || !process.env.DATABASE_URL) return;

	const db = createDb(process.env.DATABASE_URL);
	try {
		let [r] = await db.select({ id: role.id }).from(role).where(eq(role.name, ROLE_NAME));
		r ??= await createRole(db, { name: ROLE_NAME, description: 'Dipakai tes e2e' });
		await setRolePermissions(db, r.id, [{ module: 'clients', action: 'read' }]);

		let [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, STAFF_EMAIL));
		u ??= await createUser(db, {
			name: 'Staf (e2e)',
			email: STAFF_EMAIL,
			password: STAFF_PASSWORD
		});
		await setUserActive(db, u.id, true);
		await setUserRoles(db, u.id, [r.id]);
	} finally {
		await db.$client.end();
	}
}
