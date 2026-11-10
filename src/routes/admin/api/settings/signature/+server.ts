import { error, json } from '@sveltejs/kit';
import { signatureConfirmSchema } from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requireOwner, requirePerm } from '#lib/server/guards.ts';
import { createSignatureUpload, setSignature } from '#lib/server/services/app-settings.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

// Signature (ttd) for invoices and kwitansi, owner only. POST = a presigned PUT for the PNG the
// browser made (trimmed, transparent background); PUT = it is uploaded, use it.

function guard(locals: App.Locals) {
	requirePerm(locals, 'business_settings', 'update');
	return requireOwner(locals);
}

export const POST: RequestHandler = async ({ locals }) => {
	guard(locals);
	return json(await createSignatureUpload(requireStorage()));
};

export const PUT: RequestHandler = async ({ locals, request }) => {
	const me = guard(locals);
	const parsed = signatureConfirmSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Data tanda tangan tidak valid.');
	try {
		await setSignature(db, requireStorage(), parsed.data.key, me.id);
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
	return json({ ok: true });
};
