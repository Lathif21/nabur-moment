import { error, fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { z } from 'zod';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { albumSchema } from '#lib/schemas/portfolio.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { type EventTypeKey, getAlbum, saveAlbum } from '#lib/server/services/portfolio.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Album editor: details + ordered media (photos, videos, embeds) with captions and a cover.
// `baru` = a new album.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'cms_portfolio', params.id === 'baru' ? 'create' : 'read');
	let album = null;
	if (params.id !== 'baru') {
		if (!z.uuid().safeParse(params.id).success) error(404, 'Album tidak ditemukan.');
		try {
			album = await getAlbum(db, params.id);
		} catch (e) {
			if (e instanceof ServiceError) error(404, e.message);
			throw e;
		}
	}
	const media: Record<string, MediaItem> = {};
	if (storage && album) {
		const ids = [...album.items.map((i) => i.mediaId), album.coverMediaId].filter(
			(v): v is string => !!v
		);
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	return {
		album,
		media,
		canEdit: can(locals.perms!, 'cms_portfolio', params.id === 'baru' ? 'create' : 'update')
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		const isNew = params.id === 'baru';
		requirePerm(locals, 'cms_portfolio', isNew ? 'create' : 'update');
		const parsed = albumSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		const input = parsed.data;
		let saved: { id: string; slug: string };
		try {
			saved = await saveAlbum(db, isNew ? null : params.id, {
				...input,
				eventType: input.eventType as EventTypeKey
			});
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			if (e.field) return fail(400, { fields: { [e.field]: e.message } });
			return fail(400, { error: e.message });
		}
		if (isNew) redirect(303, resolve('/admin/(app)/konten/portofolio/[id]', { id: saved.id }));
		return { done: 'Album disimpan. Terbitkan dari daftar Portofolio agar tampil di situs.' };
	}
};
