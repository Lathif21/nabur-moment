import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { LIST_PATHS } from '#lib/cms/lists.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { addonSchema, categorySchema, packageSchema, reorderSchema } from '#lib/schemas/lists.ts';
import { db } from '#lib/server/db/index.ts';
import { addon, packageCategory, pkg } from '#lib/server/db/schema/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import {
	deleteAddon,
	deleteCategory,
	deletePackage,
	listAddons,
	listCategories,
	listPackages,
	listStatus,
	publishList,
	reorder,
	saveAddon,
	saveCategory,
	savePackage,
	setVisible
} from '#lib/server/services/cms-lists.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Konten → Paket (03-SCREENS B7): categories + packages, add-ons; one Terbitkan for all of it
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'cms_packages', 'read');
	const [categories, packages, addons, status] = await Promise.all([
		listCategories(db),
		listPackages(db),
		listAddons(db),
		listStatus(db, 'packages')
	]);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const ids = packages.map((p) => p.imageMediaId).filter((v): v is string => !!v);
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	const perms = locals.perms!;
	return {
		categories,
		packages,
		addons,
		media,
		status,
		can: {
			create: can(perms, 'cms_packages', 'create'),
			update: can(perms, 'cms_packages', 'update'),
			delete: can(perms, 'cms_packages', 'delete')
		}
	};
};

const idOf = async (request: Request) => String((await request.formData()).get('id') ?? '');

/** Save with field errors or a general message */
async function save<T>(
	schema: z.ZodType<T>,
	raw: Record<string, unknown>,
	work: (data: T) => Promise<unknown>,
	done: string
) {
	const parsed = schema.safeParse(raw);
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		await work(parsed.data);
		return { done };
	} catch (e) {
		if (!(e instanceof ServiceError)) throw e;
		if (e.field) return fail(400, { fields: { [e.field]: e.message } });
		return fail(400, { error: e.message });
	}
}

async function reorderAction(
	request: Request,
	table: typeof pkg | typeof addon | typeof packageCategory
) {
	const parsed = reorderSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Urutan tidak valid.' });
	return runSimpleAction(() => reorder(db, table, parsed.data.ids), 'Urutan disimpan.');
}

export const actions: Actions = {
	savePackage: async ({ request, locals }) => {
		const raw = formObject(await request.formData());
		requirePerm(locals, 'cms_packages', raw.id ? 'update' : 'create');
		return save(
			packageSchema,
			raw,
			(d) => savePackage(db, d),
			raw.id ? 'Paket disimpan.' : 'Paket ditambahkan.'
		);
	},
	visiblePackage: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'update');
		const f = await request.formData();
		const visible = f.get('visible') === 'true';
		return runSimpleAction(
			() => setVisible(db, pkg, String(f.get('id') ?? ''), visible),
			visible ? 'Paket ditampilkan.' : 'Paket disembunyikan.'
		);
	},
	reorderPackages: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'update');
		return reorderAction(request, pkg);
	},
	deletePackage: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'delete');
		const id = await idOf(request);
		return runSimpleAction(() => deletePackage(db, id), 'Paket dihapus.');
	},

	saveCategory: async ({ request, locals }) => {
		const raw = formObject(await request.formData());
		requirePerm(locals, 'cms_packages', raw.id ? 'update' : 'create');
		return save(categorySchema, raw, (d) => saveCategory(db, d), 'Kategori disimpan.');
	},
	reorderCategories: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'update');
		return reorderAction(request, packageCategory);
	},
	deleteCategory: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'delete');
		const id = await idOf(request);
		return runSimpleAction(() => deleteCategory(db, id), 'Kategori dihapus.');
	},

	saveAddon: async ({ request, locals }) => {
		const raw = formObject(await request.formData());
		requirePerm(locals, 'cms_packages', raw.id ? 'update' : 'create');
		return save(
			addonSchema,
			raw,
			(d) => saveAddon(db, d),
			raw.id ? 'Add-on disimpan.' : 'Add-on ditambahkan.'
		);
	},
	reorderAddons: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'update');
		return reorderAction(request, addon);
	},
	deleteAddon: async ({ request, locals }) => {
		requirePerm(locals, 'cms_packages', 'delete');
		const id = await idOf(request);
		return runSimpleAction(() => deleteAddon(db, id), 'Add-on dihapus.');
	},

	publish: async ({ locals }) => {
		const user = requirePerm(locals, 'cms_packages', 'update');
		return runSimpleAction(async () => {
			await publishList(db, 'packages', user.id);
			await revalidate(LIST_PATHS.packages);
		}, 'Paket dan add-on diterbitkan.');
	}
};
