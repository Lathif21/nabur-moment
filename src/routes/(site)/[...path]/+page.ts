import { error } from '@sveltejs/kit';
import { bookingHref, siteNav } from '#lib/nav.ts';
import type { PageLoad } from './$types';

// Placeholder for public pages that are not built yet (Phase 1). A real route at the same path
// takes precedence; anything else is a 404.
const pages = [...siteNav, { label: 'Booking', href: bookingHref }];

export const load: PageLoad = ({ params }) => {
	const item = pages.find((p) => p.href === params.path);
	if (!item || item.href === '') error(404, 'Halaman tidak ditemukan');
	return { title: item.label };
};
