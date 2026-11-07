import { fail } from '@sveltejs/kit';
import {
	fieldErrors,
	formObject,
	newUserSchema,
	resetPasswordSchema,
	userActiveSchema,
	userRolesSchema
} from '#lib/schemas/access.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { addUser, listRoles, setUserActive, setUserRoles } from '#lib/server/services/access.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { listUsers, resetPassword } from '#lib/server/services/users.ts';
import type { Actions, PageServerLoad } from './$types';

// Akses & Peran → Pengguna (03-SCREENS B9). `access` is owner-only, so only the owner gets here.
export const load: PageServerLoad = async ({ locals }) => {
	const me = requirePerm(locals, 'access', 'read');
	const [users, roles] = await Promise.all([listUsers(db), listRoles(db)]);
	return { users, roles: roles.map(({ id, name }) => ({ id, name })), meId: me.id };
};

export const actions: Actions = {
	/** Returns the password once when it was generated */
	add: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'create');
		const parsed = newUserSchema.safeParse(formObject(await request.formData(), ['roleIds']));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		try {
			const made = await addUser(db, {
				...parsed.data,
				password: parsed.data.password || undefined
			});
			return {
				done: `Pengguna ${parsed.data.name} ditambahkan.`,
				credentials: made.generated
					? { name: parsed.data.name, email: made.email, password: made.password }
					: null
			};
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			return fail(400, { fields: { [e.field ?? 'email']: e.message } });
		}
	},

	resetPassword: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'update');
		const parsed = resetPasswordSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		try {
			const r = await resetPassword(db, parsed.data.userId, parsed.data.password || undefined);
			return {
				done: `Kata sandi ${r.name} diganti. Semua sesinya sudah keluar.`,
				credentials: r.generated ? { name: r.name, email: r.email, password: r.password } : null
			};
		} catch (e) {
			if (!(e instanceof ServiceError)) throw e;
			return fail(400, { fields: { [e.field ?? 'password']: e.message } });
		}
	},

	setRoles: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'update');
		const parsed = userRolesSchema.safeParse(formObject(await request.formData(), ['roleIds']));
		if (!parsed.success) return fail(400, { error: 'Data peran tidak valid.' });
		return runSimpleAction(
			() => setUserRoles(db, parsed.data.userId, parsed.data.roleIds),
			'Peran pengguna disimpan.'
		);
	},

	setActive: async ({ request, locals }) => {
		requirePerm(locals, 'access', 'update');
		const parsed = userActiveSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { error: 'Data tidak valid.' });
		const { userId, active } = parsed.data;
		return runSimpleAction(
			() => setUserActive(db, userId, active),
			active ? 'Pengguna diaktifkan kembali.' : 'Pengguna dinonaktifkan dan sudah keluar.'
		);
	}
};
