import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { pdfFileName } from '#lib/server/pdf/common.ts';
import { renderReceiptPdf } from '#lib/server/pdf/receipt-pdf.ts';
import { pdfSigner, readAppSettings } from '#lib/server/services/app-settings.ts';
import { storage } from '#lib/server/storage/index.ts';
import { getPaymentForReceipt } from '#lib/server/services/payments.ts';
import type { RequestHandler } from './$types';

/** The kwitansi of one payment as a PDF. `?view` opens it in the browser instead. */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	requirePerm(locals, 'payments', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Pembayaran tidak ditemukan.');
	const [p, settings] = await Promise.all([
		getPaymentForReceipt(db, params.id),
		readAppSettings(db)
	]);
	if (!p) error(404, 'Pembayaran tidak ditemukan.');
	// Signature (ttd) from Pengaturan; without one the PDF keeps an empty signature line
	const pdf = await renderReceiptPdf(p, settings, await pdfSigner(settings, storage));
	const disposition = url.searchParams.has('view') ? 'inline' : 'attachment';
	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `${disposition}; filename="${pdfFileName(p.receiptNumber)}"`,
			'cache-control': 'private, no-store'
		}
	});
};
