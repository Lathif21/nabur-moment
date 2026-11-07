import { error } from '@sveltejs/kit';
import type { PageMeta } from '#lib/server/site.ts';
import { loadAlbum } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// One album. Only published albums exist here: a hidden album, or one added after the last
// Terbitkan, is a 404 until the next Terbitkan.
export const load: PageServerLoad = async (event) => {
	const found = await loadAlbum(event, event.params.slug);
	if (!found) error(404, 'Album tidak ditemukan');
	const { album, media } = found;
	const meta: PageMeta = {
		title: album.title,
		description: album.story.replace(/\s+/g, ' ').slice(0, 160),
		image: (album.cover && media[album.cover]?.src) || ''
	};
	return { ...found, meta };
};
