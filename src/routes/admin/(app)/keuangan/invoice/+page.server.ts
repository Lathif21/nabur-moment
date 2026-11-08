import { invoiceFilterSchema } from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listInvoices, refreshOverdue } from '#lib/server/services/invoices.ts';
import type { PageServerLoad } from './$types';

// Invoice list (03-SCREENS B6): status chips, issue month, search by number / client / booking.
// Invoices are created from the booking page (they always belong to a booking).
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'invoices', 'read');
	const p = url.searchParams;
	const filter = invoiceFilterSchema.parse({
		q: p.get('q') ?? '',
		status: p.get('status') || null,
		month: p.get('bulan') || null
	});
	await refreshOverdue(db);
	return { ...(await listInvoices(db, filter)), filter };
};
