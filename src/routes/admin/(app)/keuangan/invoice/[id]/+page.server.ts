import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import { markSentAction, voidInvoiceAction } from '#lib/server/actions/invoices.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { getInvoice, refreshOverdue } from '#lib/server/services/invoices.ts';
import type { Actions, PageServerLoad } from './$types';

// Invoice page (03-SCREENS B6): items, status, "Tandai terkirim", "Batalkan (void)", payments.
// "Unduh PDF" arrives with P3-03.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'invoices', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Invoice tidak ditemukan.');
	await refreshOverdue(db);
	const found = await getInvoice(db, params.id);
	if (!found) error(404, 'Invoice tidak ditemukan.');
	const perms = locals.perms!;
	return {
		invoice: found,
		allow: {
			update: can(perms, 'invoices', 'update'),
			void: can(perms, 'invoices', 'delete'),
			booking: can(perms, 'bookings', 'read')
		}
	};
};

export const actions: Actions = {
	sent: markSentAction,
	void: voidInvoiceAction
};
