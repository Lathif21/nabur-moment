import { loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Beranda reads the CMS (published, or the draft in preview). Sections render as they are built
// (hero now, the rest in P1-06).
export const load: PageServerLoad = async (event) => ({
	headerOverlay: true,
	...(await loadPublicPage(event, 'home'))
});
