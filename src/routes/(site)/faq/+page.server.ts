import { loadPublicList, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// FAQ: intro from the CMS page, items from the published FAQ list (P1-06 adds the full design)
export const load: PageServerLoad = async (event) => {
	const [page, faq] = await Promise.all([
		loadPublicPage(event, 'faq'),
		loadPublicList(event, 'faq')
	]);
	return { ...page, faq: faq.data };
};
