import { fail } from '@sveltejs/kit';
import { can } from '#lib/permissions.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { appSettingsSchema } from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { bankReady, readAppSettings, saveAppSettings } from '#lib/server/services/app-settings.ts';
import type { Actions, PageServerLoad } from './$types';

// Pengaturan → Bisnis & Keuangan (03-SCREENS B8): the profile printed on invoices and kwitansi and
// the BCA account shown on invoices. Expense categories and lead sources join this page later.
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'business_settings', 'read');
	const settings = await readAppSettings(db);
	return {
		settings,
		bankReady: bankReady(settings),
		canEdit: can(locals.perms!, 'business_settings', 'update')
	};
};

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const me = requirePerm(locals, 'business_settings', 'update');
		const parsed = appSettingsSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
		await saveAppSettings(db, parsed.data, me.id);
		return { done: 'Pengaturan bisnis disimpan.' };
	}
};
