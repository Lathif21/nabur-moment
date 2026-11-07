import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { loadPermissions } from '#lib/server/services/access.ts';

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
			// Loaded here, not in a layout: form actions run before layout loads.
			// Role changes therefore apply on the user's next request.
			event.locals.perms = await loadPermissions(db, session.user);
		}
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	// The admin is never indexed, whatever a crawler finds
	if (pathname.startsWith('/admin')) {
		try {
			response.headers.set('x-robots-tag', 'noindex, nofollow');
		} catch {
			// immutable headers (e.g. a native redirect): the page itself has the robots meta
		}
	}
	return response;
};
