import { fail } from '@sveltejs/kit';
import { LIST_PATHS } from '#lib/cms/lists.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { reorderSchema, testimonialSchema } from '#lib/schemas/lists.ts';
import { db } from '#lib/server/db/index.ts';
import { testimonial } from '#lib/server/db/schema/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import {
	deleteTestimonial,
	listStatus,
	listTestimonials,
	publishList,
	reorder,
	saveTestimonial,
	setVisible
} from '#lib/server/services/cms-lists.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Konten → Testimoni (03-SCREENS B7)
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'cms_testimonials', 'read');
	const [items, status] = await Promise.all([listTestimonials(db), listStatus(db, 'testimonials')]);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const ids = items.map((i) => i.photoMediaId).filter((v): v is string => !!v);
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	const perms = locals.perms!;
	return {
		items,
		media,
		status,
		can: {
			create: can(perms, 'cms_testimonials', 'create'),
			update: can(perms, 'cms_testimonials', 'update'),
			delete: can(perms, 'cms_testimonials', 'delete')
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const raw = formObject(await request.formData());
		requirePerm(locals, 'cms_testimonials', raw.id ? 'update' : 'create');
		const parsed = testimonialSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		try {
			await saveTestimonial(db, parsed.data);
			return { done: parsed.data.id ? 'Testimoni disimpan.' : 'Testimoni ditambahkan.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(400, { error: e.message });
			throw e;
		}
	},

	visible: async ({ request, locals }) => {
		requirePerm(locals, 'cms_testimonials', 'update');
		const f = await request.formData();
		const visible = f.get('visible') === 'true';
		return runSimpleAction(
			() => setVisible(db, testimonial, String(f.get('id') ?? ''), visible),
			visible ? 'Testimoni ditampilkan.' : 'Testimoni disembunyikan.'
		);
	},

	reorder: async ({ request, locals }) => {
		requirePerm(locals, 'cms_testimonials', 'update');
		const parsed = reorderSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Urutan tidak valid.' });
		return runSimpleAction(() => reorder(db, testimonial, parsed.data.ids), 'Urutan disimpan.');
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'cms_testimonials', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteTestimonial(db, id), 'Testimoni dihapus.');
	},

	publish: async ({ locals }) => {
		const user = requirePerm(locals, 'cms_testimonials', 'update');
		return runSimpleAction(async () => {
			await publishList(db, 'testimonials', user.id);
			await revalidate(LIST_PATHS.testimonials);
		}, 'Testimoni diterbitkan.');
	}
};
