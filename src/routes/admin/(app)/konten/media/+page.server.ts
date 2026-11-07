import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { embedSchema, mediaListQuery, mediaUpdateSchema } from '#lib/schemas/media.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { createEmbed, deleteMedia, listMedia, updateMedia } from '#lib/server/services/media.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Konten → Media (03-SCREENS B7): library grid, filters, upload, detail drawer
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'media', 'read');
	const q = mediaListQuery.parse(Object.fromEntries(url.searchParams));
	const storage = requireStorage();
	const rows = await listMedia(db, { kind: q.kind, unused: q.unused, limit: 200 });
	const perms = locals.perms!;
	return {
		items: rows.map((r) => toMediaItem(r, storage)),
		filter: q,
		can: {
			create: can(perms, 'media', 'create'),
			update: can(perms, 'media', 'update'),
			delete: can(perms, 'media', 'delete')
		}
	};
};

export const actions: Actions = {
	embed: async ({ request, locals }) => {
		const user = requirePerm(locals, 'media', 'create');
		const parsed = embedSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		try {
			await createEmbed(db, parsed.data, user.id);
			return { done: 'Embed ditambahkan.' };
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			return fail(400, { fields: { url: e.message } });
		}
	},

	update: async ({ request, locals }) => {
		requirePerm(locals, 'media', 'update');
		const parsed = mediaUpdateSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Data media tidak valid.' });
		const { id, ...patch } = parsed.data;
		return runSimpleAction(() => updateMedia(db, id, patch), 'Media disimpan.');
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'media', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteMedia(db, requireStorage(), id), 'Media dihapus.');
	}
};
