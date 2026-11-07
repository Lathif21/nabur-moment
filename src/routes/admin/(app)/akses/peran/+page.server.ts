import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { fieldErrors, formObject, roleSchema } from '#lib/schemas/access.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { createRole, deleteRole, listRoles } from '#lib/server/services/access.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import type { Actions, PageServerLoad } from './$types';

// Akses & Peran → Peran (03-SCREENS B9), owner only via the `access` module
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'access', 'read');
	return { roles: await listRoles(db) };
};

export const actions: Actions = {
	/** A new role opens straight in the matrix editor */
	create: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'create');
		const parsed = roleSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		let id: string;
		try {
			({ id } = await createRole(db, parsed.data));
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			return fail(400, { fields: { [e.field ?? 'name']: e.message } });
		}
		redirect(303, resolve('/admin/(app)/akses/peran/[id]', { id }));
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteRole(db, id), 'Peran dihapus.');
	}
};
