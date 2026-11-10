import { loadPortfolio, loadPublicList, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Beranda: CMS sections (published, or drafts in preview) + the lists they show
export const load: PageServerLoad = async (event) => {
	const [page, testimonials, portfolio] = await Promise.all([
		loadPublicPage(event, 'home'),
		loadPublicList(event, 'testimonials'),
		// Every published album, as on /portofolio
		loadPortfolio(event)
	]);
	return {
		headerOverlay: true,
		...page,
		testimonials: testimonials.data,
		albums: portfolio.albums,
		// Instagram posts arrive with P1-10; until then the follow section shows its fallback images
		posts: [] as { id: string; image: string; permalink: string; caption: string }[],
		media: { ...page.media, ...testimonials.media, ...portfolio.media }
	};
};
