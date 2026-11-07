import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import { archiveClientAction, updateClientAction } from '#lib/server/actions/clients.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { getClient, listLeadSources } from '#lib/server/services/clients.ts';
import type { Actions, PageServerLoad } from './$types';

// Client page (03-SCREENS B5): contact buttons, details, bookings, totals, activity.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'clients', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Klien tidak ditemukan.');
	const found = await getClient(db, params.id);
	if (!found) error(404, 'Klien tidak ditemukan.');
	const perms = locals.perms!;
	return {
		...found,
		sources: await listLeadSources(db, found.client.sourceId),
		allow: {
			update: can(perms, 'clients', 'update'),
			delete: can(perms, 'clients', 'delete')
		}
	};
};

export const actions: Actions = {
	update: updateClientAction,
	archive: archiveClientAction
};
