// Better Auth options without SvelteKit imports, so DB specs build the same instance as the app
// (auth.ts adds env + the cookie plugin). Relative imports only.
import type { BetterAuthPlugin } from 'better-auth';
import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import type { DbOrTx } from './db/client.ts';
import { isActiveUser } from './services/users.ts';

export const INACTIVE_MESSAGE = 'Akun ini tidak aktif.';
/** Lifetime of a "lupa kata sandi" link, in seconds */
export const RESET_TOKEN_TTL = 60 * 60;

/** Delivers a reset token (auth.ts emails a link; DB specs capture it) */
export type SendResetPassword = (data: {
	user: { email: string; name: string };
	token: string;
}) => Promise<void>;

export function createAuth(
	db: DbOrTx,
	opts: {
		baseURL?: string;
		secret?: string;
		plugins?: BetterAuthPlugin[];
		sendResetPassword?: SendResetPassword;
	}
) {
	return betterAuth({
		baseURL: opts.baseURL,
		secret: opts.secret,
		database: drizzleAdapter(db, { provider: 'pg' }),
		// No public sign-up: users come from scripts/create-user.ts or Akses & Peran → Pengguna
		emailAndPassword: {
			enabled: true,
			disableSignUp: true,
			minPasswordLength: 8,
			// "Lupa kata sandi?" on the login page: the link is single-use, and setting a new
			// password signs the user out everywhere
			resetPasswordTokenExpiresIn: RESET_TOKEN_TTL,
			revokeSessionsOnPasswordReset: true,
			sendResetPassword: async ({ user, token }) => {
				// Inactive users cannot sign in anyway, so they get no mail. The response is the same
				// either way, so the form never reveals which emails exist.
				if (!opts.sendResetPassword || !(await isActiveUser(db, user.id))) return;
				await opts.sendResetPassword({ user, token });
			}
		},
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
