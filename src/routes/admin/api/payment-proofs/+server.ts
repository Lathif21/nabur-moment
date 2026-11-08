import { error, json } from '@sveltejs/kit';
import { proofUploadSchema } from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { createProofUpload } from '#lib/server/services/payment-proofs.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

/** Proof upload step 1: a pending private row + a presigned PUT to the private bucket */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requirePerm(locals, 'payments', 'create');
	const parsed = proofUploadSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Data unggahan tidak valid.');
	try {
		return json(await createProofUpload(db, requireStorage(), parsed.data, user.id));
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
