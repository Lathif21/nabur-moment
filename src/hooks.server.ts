import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.ts';

export const handle: Handle = async ({ event, resolve }) => {
	// Only the admin, the auth API and draft previews need a session; public pages stay cacheable
	const { pathname, searchParams } = event.url;
	if (
		pathname.startsWith('/admin') ||
		pathname.startsWith('/api/auth') ||
		searchParams.has('preview')
	) {
		const session = await auth.api.getSession({ headers: event.request.headers });
		// A user deactivated mid-session is treated as logged out (their sessions are also deleted)
		if (session?.user.active) {
			event.locals.user = session.user;
			event.locals.session = session.session;
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};
