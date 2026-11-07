import { error } from '@sveltejs/kit';
import { adminNavItems } from '#lib/nav.ts';
import { requirePerm } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';

// Placeholder for sidebar destinations that are not built yet. A real route at the same path
// takes precedence, so each task simply adds its own folder (with its own requirePerm).
export const load: PageServerLoad = ({ params, locals }) => {
	const item = adminNavItems.find((i) => i.href === `admin/${params.path}`);
	if (!item) error(404, 'Halaman tidak ditemukan');
	requirePerm(locals, item.module, 'read');
	return { title: item.label };
};
