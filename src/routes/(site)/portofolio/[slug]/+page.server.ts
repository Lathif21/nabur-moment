import { error } from '@sveltejs/kit';
import { pictureOf } from '#lib/media/cover.ts';
import type { PageMeta } from '#lib/server/site.ts';
import { loadAlbum, loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// One album. Only published albums exist here: a hidden album, or one added after the last
// Terbitkan, is a 404 until the next Terbitkan.
export const load: PageServerLoad = async (event) => {
	const [found, page] = await Promise.all([
		loadAlbum(event, event.params.slug),
		loadPublicPage(event, 'portfolio')
	]);
	if (!found) error(404, 'Album tidak ditemukan');
	const { album, media } = found;
	const meta: PageMeta = {
		title: album.title,
		description: album.story.replace(/\s+/g, ' ').slice(0, 160),
		// The cover's still: the photo, a video poster or a YouTube still (never the embed URL)
		image: (album.cover && pictureOf(media[album.cover])?.src) || ''
	};
	// Texts around the album come from the Portofolio page (Konten → Halaman → Halaman album)
	return { ...found, copy: page.sections.album.data, meta };
};
