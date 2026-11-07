import type { Permission } from '#lib/permissions.ts';
import type { AuthSession, AuthUser } from '#lib/server/auth-config.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: AuthUser;
			session?: AuthSession;
			/** Set with the session in hooks.server.ts (owner = everything) */
			perms?: Set<Permission>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
