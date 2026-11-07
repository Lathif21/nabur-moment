import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { can, type CrudAction, type ModuleKey } from '#lib/permissions.ts';
import type { AuthUser } from './auth.ts';

export const FORBIDDEN_MESSAGE = 'Anda tidak punya akses ke halaman atau tindakan ini.';

/** Logged in, or off to the login page */
export function requireUser(locals: App.Locals): AuthUser {
	if (!locals.user) redirect(303, resolve('admin/login'));
	return locals.user;
}

/**
 * Every admin load and form action calls this first (CLAUDE.md). Logged out → login; missing
 * permission → 403 (an error page for loads; for actions `use:enhance` shows the same page).
 * The sidebar and buttons check the same set with `can()`.
 */
export function requirePerm(
	locals: App.Locals,
	module: ModuleKey,
	action: CrudAction = 'read'
): AuthUser {
	const user = requireUser(locals);
	if (!locals.perms || !can(locals.perms, module, action)) error(403, FORBIDDEN_MESSAGE);
	return user;
}

/** Akses & Peran and other owner-only places */
export function requireOwner(locals: App.Locals): AuthUser {
	const user = requireUser(locals);
	if (!user.isOwner) error(403, FORBIDDEN_MESSAGE);
	return user;
}
