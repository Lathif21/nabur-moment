import { loadFeaturedAlbums, loadPublicList, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Beranda: CMS sections (published, or drafts in preview) + the lists they show
export const load: PageServerLoad = async (event) => {
	const page = await loadPublicPage(event, 'home');
	const featuredCount = Number(page.sections.featured.data.count) || 3;
	const [testimonials, featured] = await Promise.all([
		loadPublicList(event, 'testimonials'),
		loadFeaturedAlbums(event, featuredCount)
	]);
	return {
		headerOverlay: true,
		...page,
		testimonials: testimonials.data,
		featured: featured.albums,
		// Instagram posts arrive with P1-10; until then the follow section shows its fallback images
		posts: [] as { id: string; image: string; permalink: string; caption: string }[],
		media: { ...page.media, ...testimonials.media, ...featured.media }
	};
};
