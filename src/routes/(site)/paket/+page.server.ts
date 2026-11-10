import { loadPublicList, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Paket: optional hero, intro, list labels + notes from the CMS page, packages and add-ons from the published list
export const load: PageServerLoad = async (event) => {
	const [page, packages] = await Promise.all([
		loadPublicPage(event, 'packages'),
		loadPublicList(event, 'packages')
	]);
	return {
		headerOverlay: page.sections.hero.visible,
		...page,
		packages: packages.data,
		media: { ...page.media, ...packages.media }
	};
};
