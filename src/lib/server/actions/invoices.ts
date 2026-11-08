// Invoice form actions shared by the booking page (create) and the invoice pages (sent / void).
import { fail, type RequestEvent } from '@sveltejs/kit';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import {
	customInvoiceSchema,
	installmentInvoiceSchema,
	invoiceIdSchema
} from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import {
	createCustomInvoice,
	createInstallmentInvoice,
	markInvoiceSent,
	voidInvoice
} from '#lib/server/services/invoices.ts';

type Event = Pick<RequestEvent, 'request' | 'locals'>;

function serviceFail(e: unknown) {
	if (!(e instanceof ServiceError)) throw e;
	return fail(400, {
		error: e.message,
		fields: e.field ? { [e.field]: e.message } : {}
	});
}

/** Item row errors keep their full path (items.0.unitPrice) next to the first-level ones */
function itemErrors(issues: Parameters<typeof fieldErrors>[0]) {
	const out = fieldErrors(issues);
	for (const i of issues) if (i.path.length > 1) out[i.path.join('.')] ??= i.message;
	return out;
}

export async function createInstallmentInvoiceAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'invoices', 'create');
	const parsed = installmentInvoiceSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		const row = await createInstallmentInvoice(db, parsed.data, me.id);
		return { done: `Invoice ${row.number} dibuat.`, invoiceId: row.id };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function createCustomInvoiceAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'invoices', 'create');
	const parsed = customInvoiceSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: itemErrors(parsed.error.issues) });
	try {
		const row = await createCustomInvoice(db, parsed.data, me.id);
		return { done: `Invoice ${row.number} dibuat.`, invoiceId: row.id };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function markSentAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'invoices', 'update');
	const parsed = invoiceIdSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Invoice tidak valid.' });
	try {
		const row = await markInvoiceSent(db, parsed.data.id, me.id);
		return { done: `Invoice ${row.number} ditandai terkirim.` };
	} catch (e) {
		return serviceFail(e);
	}
}

/** Void counts as delete (02-DATA-MODEL: invoices delete = void) */
export async function voidInvoiceAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'invoices', 'delete');
	const parsed = invoiceIdSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Invoice tidak valid.' });
	try {
		const row = await voidInvoice(db, parsed.data.id, me.id);
		return { done: `Invoice ${row.number} dibatalkan.` };
	} catch (e) {
		return serviceFail(e);
	}
}
