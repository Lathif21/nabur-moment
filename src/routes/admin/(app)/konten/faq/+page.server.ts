import { fail } from '@sveltejs/kit';
import { LIST_PATHS } from '#lib/cms/lists.ts';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { faqSchema, reorderSchema } from '#lib/schemas/lists.ts';
import { db } from '#lib/server/db/index.ts';
import { faqItem } from '#lib/server/db/schema/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import {
	deleteFaq,
	listFaq,
	listStatus,
	publishList,
	reorder,
	saveFaq,
	setVisible
} from '#lib/server/services/cms-lists.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import type { Actions, PageServerLoad } from './$types';

// Konten → FAQ (03-SCREENS B7): sortable list, drawer editor, show / hide, Terbitkan
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'cms_faq', 'read');
	const [items, status] = await Promise.all([listFaq(db), listStatus(db, 'faq')]);
	const perms = locals.perms!;
	return {
		items,
		status,
		can: {
			create: can(perms, 'cms_faq', 'create'),
			update: can(perms, 'cms_faq', 'update'),
			delete: can(perms, 'cms_faq', 'delete')
		}
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const raw = formObject(await request.formData());
		requirePerm(locals, 'cms_faq', raw.id ? 'update' : 'create');
		const parsed = faqSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		try {
			await saveFaq(db, parsed.data);
			return { done: parsed.data.id ? 'Pertanyaan disimpan.' : 'Pertanyaan ditambahkan.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(400, { error: e.message });
			throw e;
		}
	},

	visible: async ({ request, locals }) => {
		requirePerm(locals, 'cms_faq', 'update');
		const f = await request.formData();
		const visible = f.get('visible') === 'true';
		return runSimpleAction(
			() => setVisible(db, faqItem, String(f.get('id') ?? ''), visible),
			visible ? 'Pertanyaan ditampilkan.' : 'Pertanyaan disembunyikan.'
		);
	},

	reorder: async ({ request, locals }) => {
		requirePerm(locals, 'cms_faq', 'update');
		const parsed = reorderSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Urutan tidak valid.' });
		return runSimpleAction(() => reorder(db, faqItem, parsed.data.ids), 'Urutan disimpan.');
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'cms_faq', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteFaq(db, id), 'Pertanyaan dihapus.');
	},

	publish: async ({ locals }) => {
		const user = requirePerm(locals, 'cms_faq', 'update');
		return runSimpleAction(async () => {
			await publishList(db, 'faq', user.id);
			await revalidate(LIST_PATHS.faq);
		}, 'FAQ diterbitkan.');
	}
};
