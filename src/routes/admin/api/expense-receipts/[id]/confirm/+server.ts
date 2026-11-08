import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { confirmProofUpload } from '#lib/server/services/payment-proofs.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

/** Expense receipt upload step 2: the file is in the bucket → ready */
export const POST: RequestHandler = async ({ locals, params }) => {
	requirePerm(locals, 'expenses', 'create');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Nota tidak ditemukan.');
	try {
		const row = await confirmProofUpload(db, requireStorage(), params.id);
		return json({ id: row.id, filename: row.filename });
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
