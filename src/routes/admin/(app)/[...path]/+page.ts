import { error } from '@sveltejs/kit';
import { adminNavItems } from '#lib/nav.ts';
import type { PageLoad } from './$types';

// Placeholder for sidebar destinations that are not built yet. A real route at the same path
// takes precedence, so each task simply adds its own folder.
export const load: PageLoad = ({ params }) => {
	const item = adminNavItems.find((i) => i.href === `admin/${params.path}`);
	if (!item) error(404, 'Halaman tidak ditemukan');
	return { title: item.label };
};
