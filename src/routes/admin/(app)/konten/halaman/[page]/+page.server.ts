import { error } from '@sveltejs/kit';
import { isPageKey, PAGE_BY_KEY } from '#lib/cms/sections.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import {
	getPageForEdit,
	pageMediaIds,
	publishPage,
	revertPage
} from '#lib/server/services/cms-pages.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { publicPathsFor } from '#lib/server/site.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Page editor: one card per registry section, fields generated from the registry
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'cms_pages', 'read');
	if (!isPageKey(params.page)) error(404, 'Halaman tidak ditemukan.');
	const sections = await getPageForEdit(db, params.page);
	const ids = pageMediaIds(
		params.page,
		Object.fromEntries(sections.map((s) => [s.key, { data: s.draft }]))
	);
	const media: Record<string, MediaItem> = {};
	if (storage) for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	return {
		pageKey: params.page,
		title: PAGE_BY_KEY.get(params.page)!.label,
		sections,
		media,
		canEdit: can(locals.perms!, 'cms_pages', 'update'),
		// Remounts the editor after Terbitkan / Kembalikan so it shows the stored drafts
		version: Date.now()
	};
};

export const actions: Actions = {
	publish: async ({ locals, params }) => {
		const user = requirePerm(locals, 'cms_pages', 'update');
		if (!isPageKey(params.page)) error(404, 'Halaman tidak ditemukan.');
		const page = params.page;
		return runSimpleAction(async () => {
			await publishPage(db, page, user.id);
			await revalidate(await publicPathsFor(page));
		}, 'Halaman diterbitkan. Perubahan sudah tampil di situs.');
	},

	revert: async ({ locals, params }) => {
		requirePerm(locals, 'cms_pages', 'update');
		if (!isPageKey(params.page)) error(404, 'Halaman tidak ditemukan.');
		const page = params.page;
		return runSimpleAction(() => revertPage(db, page), 'Draf dikembalikan ke versi terbit.');
	}
};
