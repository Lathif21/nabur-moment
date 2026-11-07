import { loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Tentang: hero, story, approach, team, CTA from the CMS
export const load: PageServerLoad = async (event) => ({
	headerOverlay: true,
	...(await loadPublicPage(event, 'about'))
});
