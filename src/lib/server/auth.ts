import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { db } from '#lib/server/db/index.ts';
import { createAuth } from './auth-config.ts';

export const auth = createAuth(db, {
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	plugins: [
		sveltekitCookies(getRequestEvent) // must stay the last plugin
	]
});

export type { AuthSession, AuthUser } from './auth-config.ts';
