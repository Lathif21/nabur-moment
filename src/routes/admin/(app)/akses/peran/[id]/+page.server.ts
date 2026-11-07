import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import { fieldErrors, formObject, grantsSchema, roleSchema } from '#lib/schemas/access.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { getRole, saveRole } from '#lib/server/services/access.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import type { Actions, PageServerLoad } from './$types';

// Role editor: name + description + the CRUD matrix (03-SCREENS B9)
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'access', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Peran tidak ditemukan.');
	try {
		const r = await getRole(db, params.id);
		return { role: { ...r, grants: r.grants.map((g) => `${g.module}:${g.action}`) } };
	} catch (e) {
		if (e instanceof ServiceError) error(404, e.message);
		throw e;
	}
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		requirePerm(locals, 'access', 'update');
		const raw = formObject(await request.formData(), ['grant']);
		const parsed = roleSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		const grants = grantsSchema.safeParse(raw.grant ?? []);
		if (!grants.success) return fail(400, { error: 'Isi matriks tidak valid.' });
		try {
			await saveRole(db, params.id, { ...parsed.data, grants: grants.data });
			return { done: `Peran ${parsed.data.name} disimpan. Berlaku pada halaman berikutnya.` };
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			if (e.field) return fail(400, { fields: { [e.field]: e.message } });
			return fail(400, { error: e.message });
		}
	}
};
