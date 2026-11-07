import { fail } from '@sveltejs/kit';
import { LIST_PATHS } from '#lib/cms/lists.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { formObject } from '#lib/schemas/access.ts';
import { reorderSchema } from '#lib/schemas/lists.ts';
import { db } from '#lib/server/db/index.ts';
import { portfolioAlbum } from '#lib/server/db/schema/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import {
	listStatus,
	publishList,
	readList,
	reorder,
	setVisible
} from '#lib/server/services/cms-lists.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { deleteAlbum, listAlbums } from '#lib/server/services/portfolio.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Konten → Portofolio (03-SCREENS B7): album list (order, featured, show / hide) + Terbitkan
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'cms_portfolio', 'read');
	const [albums, status] = await Promise.all([listAlbums(db), listStatus(db, 'portfolio')]);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const ids = albums.map((a) => a.coverMediaId).filter((v): v is string => !!v);
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	const perms = locals.perms!;
	return {
		albums,
		media,
		status,
		can: {
			create: can(perms, 'cms_portfolio', 'create'),
			update: can(perms, 'cms_portfolio', 'update'),
			delete: can(perms, 'cms_portfolio', 'delete')
		}
	};
};

export const actions: Actions = {
	visible: async ({ request, locals }) => {
		requirePerm(locals, 'cms_portfolio', 'update');
		const f = await request.formData();
		const visible = f.get('visible') === 'true';
		return runSimpleAction(
			() => setVisible(db, portfolioAlbum, String(f.get('id') ?? ''), visible),
			visible ? 'Album ditampilkan.' : 'Album disembunyikan.'
		);
	},

	reorder: async ({ request, locals }) => {
		requirePerm(locals, 'cms_portfolio', 'update');
		const parsed = reorderSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Urutan tidak valid.' });
		return runSimpleAction(() => reorder(db, portfolioAlbum, parsed.data.ids), 'Urutan disimpan.');
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'cms_portfolio', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteAlbum(db, id), 'Album dihapus.');
	},

	publish: async ({ locals }) => {
		const user = requirePerm(locals, 'cms_portfolio', 'update');
		return runSimpleAction(async () => {
			const before = await readList(db, 'portfolio');
			const after = await publishList(db, 'portfolio', user.id);
			// Album pages that appeared, changed or disappeared
			const slugs = new Set([...before, ...after].map((a) => a.slug));
			await revalidate([...LIST_PATHS.portfolio, ...[...slugs].map((s) => `portofolio/${s}`)]);
		}, 'Portofolio diterbitkan.');
	}
};
