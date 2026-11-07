import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import type { AuthUser } from './auth.ts';

/**
 * Use at the top of every admin load / form action. P0-05 adds `requirePerm(locals, module,
 * action)` on top of this.
 */
export function requireUser(locals: App.Locals): AuthUser {
	if (!locals.user) redirect(303, resolve('admin/login'));
	return locals.user;
}
