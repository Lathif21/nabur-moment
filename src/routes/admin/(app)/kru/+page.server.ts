import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { resolvePeriod } from '#lib/period.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { crewSchema } from '#lib/schemas/crm.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { createCrew, deleteCrew, listCrew, updateCrew } from '#lib/server/services/crew.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import type { Actions, PageServerLoad } from './$types';

// Kru: the people who work events (an asset, no login) and how many bookings each handles in the
// period (booked onward, never Batal, by Hari H)
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'crew', 'read');
	const p = url.searchParams;
	const period = resolvePeriod({ period: p.get('period'), from: p.get('from'), to: p.get('to') });
	const perms = locals.perms!;
	return {
		crew: await listCrew(db, period),
		period,
		allow: {
			create: can(perms, 'crew', 'create'),
			update: can(perms, 'crew', 'update'),
			delete: can(perms, 'crew', 'delete')
		}
	};
};

export const actions: Actions = {
	/** Create (no id) or update */
	save: async ({ request, locals }) => {
		const form = formObject(await request.formData());
		requirePerm(locals, 'crew', form.id ? 'update' : 'create');
		const parsed = crewSchema.safeParse(form);
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		const { id, ...input } = parsed.data;
		try {
			if (id) await updateCrew(db, id, input);
			else await createCrew(db, input);
			return { done: id ? 'Kru disimpan.' : 'Kru ditambahkan.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(400, { error: e.message });
			throw e;
		}
	},

	delete: async ({ request, locals }) => {
		requirePerm(locals, 'crew', 'delete');
		const id = String((await request.formData()).get('id') ?? '');
		return runSimpleAction(() => deleteCrew(db, id), 'Kru dihapus.');
	}
};
