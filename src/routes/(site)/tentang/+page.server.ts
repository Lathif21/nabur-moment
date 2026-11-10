import { loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Tentang: hero, story, approach, team, CTA from the CMS
export const load: PageServerLoad = async (event) => {
	const page = await loadPublicPage(event, 'about');
	// Cream header text only over the dark hero band
	return { headerOverlay: page.sections.hero.visible, ...page };
};
