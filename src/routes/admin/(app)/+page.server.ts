import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { can } from '#lib/permissions.ts';
import { firstAllowedHref } from '#lib/nav.ts';
import { FORBIDDEN_MESSAGE, requirePerm, requireUser } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

// /admin is where login lands; someone without Dashboard goes to their first allowed page
export const load: PageServerLoad = ({ locals }) => {
	requireUser(locals);
	const perms = [...(locals.perms ?? [])];
	if (!can(perms, 'dashboard')) {
		const href = firstAllowedHref(perms);
		if (!href) error(403, `${FORBIDDEN_MESSAGE} Minta pemilik memberi Anda peran.`);
		redirect(303, resolve(href));
	}
	requirePerm(locals, 'dashboard', 'read');
};
