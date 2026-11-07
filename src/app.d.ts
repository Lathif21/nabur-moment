import type { AuthSession, AuthUser } from '#lib/server/auth-config.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: AuthUser;
			session?: AuthSession;
			// perms arrive in P0-05
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
