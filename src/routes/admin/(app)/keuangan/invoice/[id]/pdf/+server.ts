import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { pdfFileName } from '#lib/server/pdf/common.ts';
import { renderInvoicePdf } from '#lib/server/pdf/invoice-pdf.ts';
import { readAppSettings } from '#lib/server/services/app-settings.ts';
import { getInvoice } from '#lib/server/services/invoices.ts';
import type { RequestHandler } from './$types';

/** The invoice as a PDF from its saved data. `?view` opens it in the browser instead. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	requirePerm(locals, 'invoices', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Invoice tidak ditemukan.');
	const [inv, settings] = await Promise.all([getInvoice(db, params.id), readAppSettings(db)]);
	if (!inv) error(404, 'Invoice tidak ditemukan.');
	const pdf = await renderInvoicePdf(inv, settings);
	const disposition = url.searchParams.has('view') ? 'inline' : 'attachment';
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${disposition}; filename="${pdfFileName(inv.number)}"`,
			'cache-control': 'private, no-store'
		}
	});
};
