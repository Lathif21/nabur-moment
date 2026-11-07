import { loadPortfolio, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Portofolio: intro from the CMS page + published albums (filter by event type on the page)
export const load: PageServerLoad = async (event) => {
	const [page, portfolio] = await Promise.all([
		loadPublicPage(event, 'portfolio'),
		loadPortfolio(event)
	]);
	return { ...page, albums: portfolio.albums, media: { ...page.media, ...portfolio.media } };
};
