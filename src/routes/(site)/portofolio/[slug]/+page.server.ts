import { error } from '@sveltejs/kit';
import { loadAlbum } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// One album. Only published albums exist here: a hidden album, or one added after the last
// Terbitkan, is a 404 until the next Terbitkan.
export const load: PageServerLoad = async (event) => {
	const found = await loadAlbum(event, event.params.slug);
	if (!found) error(404, 'Album tidak ditemukan');
	return found;
};
