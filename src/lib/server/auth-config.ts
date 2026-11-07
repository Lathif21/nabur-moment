// Better Auth options without SvelteKit imports, so DB specs build the same instance as the app
// (auth.ts adds env + the cookie plugin). Relative imports only.
import type { BetterAuthPlugin } from 'better-auth';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import type { DbOrTx } from './db/client.ts';
import { isActiveUser } from './services/users.ts';

export const INACTIVE_MESSAGE = 'Akun ini tidak aktif.';

export function createAuth(
	db: DbOrTx,
	opts: { baseURL?: string; secret?: string; plugins?: BetterAuthPlugin[] }
) {
	return betterAuth({
		baseURL: opts.baseURL,
		secret: opts.secret,
		database: drizzleAdapter(db, { provider: 'pg' }),
		// No public sign-up: users come from scripts/create-user.ts or Akses & Peran → Pengguna
		emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 8 },
		session: {
			expiresIn: 60 * 60 * 24 * 30,
			updateAge: 60 * 60 * 24
		},
		user: {
			additionalFields: {
				isOwner: { type: 'boolean', defaultValue: false, input: false },
				active: { type: 'boolean', defaultValue: true, input: false }
			}
		},
		databaseHooks: {
			session: {
				create: {
					// Inactive users never get a session, whatever the password
					before: async (session) => {
						if (!(await isActiveUser(db, session.userId))) {
							throw new APIError('FORBIDDEN', { message: INACTIVE_MESSAGE });
						}
					}
				}
			}
		},
		plugins: opts.plugins ?? []
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthUser = Auth['$Infer']['Session']['user'];
export type AuthSession = Auth['$Infer']['Session']['session'];
