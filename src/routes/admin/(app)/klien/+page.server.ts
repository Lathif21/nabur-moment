import { clientFilterSchema } from '#lib/schemas/crm.ts';
import {
	archiveClientAction,
	createClientAction,
	updateClientAction
} from '#lib/server/actions/clients.ts';
import { db } from '#lib/server/db/index.ts';
import { can } from '#lib/permissions.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listClients, listLeadSources } from '#lib/server/services/clients.ts';
import type { Actions, PageServerLoad } from './$types';

// Klien (03-SCREENS B5): list with search, source filter and archive view; drawer create / edit.
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'clients', 'read');
	const filter = clientFilterSchema.parse({
		q: url.searchParams.get('q') ?? '',
		sourceId: url.searchParams.get('sumber') || null,
		archived: url.searchParams.get('arsip') === '1'
	});
	const [clients, sources] = await Promise.all([listClients(db, filter), listLeadSources(db)]);
	const perms = locals.perms!;
	return {
		clients,
		sources,
		filter,
		allow: {
			create: can(perms, 'clients', 'create'),
			update: can(perms, 'clients', 'update'),
			delete: can(perms, 'clients', 'delete')
		}
	};
};

export const actions: Actions = {
	create: createClientAction,
	update: updateClientAction,
	archive: archiveClientAction
};
