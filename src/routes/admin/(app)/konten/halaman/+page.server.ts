import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listPages } from '#lib/server/services/cms-pages.ts';
import type { PageServerLoad } from './$types';

// Konten → Halaman (03-SCREENS B7): the fixed pages and whether they have unpublished changes
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'cms_pages', 'read');
	return { pages: await listPages(db) };
};
