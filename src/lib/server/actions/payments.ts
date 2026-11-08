// Payment form actions shared by the Pembayaran list and the booking page.
import { fail, type RequestEvent } from '@sveltejs/kit';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { paymentIdSchema, paymentSchema } from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { deletePayment, recordPayment } from '#lib/server/services/payments.ts';
import { PRIVATE_BUCKET, storage } from '#lib/server/storage/index.ts';

type Event = Pick<RequestEvent, 'request' | 'locals'>;

function serviceFail(e: unknown) {
	if (!(e instanceof ServiceError)) throw e;
	return fail(400, { error: e.message, fields: e.field ? { [e.field]: e.message } : {} });
}

/** `dpPaid` tells the page to offer the move to Booked */
export async function recordPaymentAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'payments', 'create');
	const parsed = paymentSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		const row = await recordPayment(db, parsed.data, me.id);
		return {
			done: `Pembayaran ${row.receiptNumber} dicatat.${row.dpPaidNow ? ' DP lunas.' : ''}`,
			dpPaid: row.dpPaidNow,
			bookingId: row.bookingId
		};
	} catch (e) {
		return serviceFail(e);
	}
}

export async function deletePaymentAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'payments', 'delete');
	const parsed = paymentIdSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Pembayaran tidak valid.' });
	try {
		const r = await deletePayment(db, parsed.data.id, me.id);
		// The row is gone; removing the proof file is best effort
		if (r.proofKey && storage) await storage.remove(PRIVATE_BUCKET, [r.proofKey]).catch(() => {});
		return { done: `Pembayaran ${r.receiptNumber} dihapus.` };
	} catch (e) {
		return serviceFail(e);
	}
}
