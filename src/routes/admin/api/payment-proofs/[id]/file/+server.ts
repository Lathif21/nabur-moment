import { error, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { proofKey } from '#lib/server/services/payment-proofs.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

/** View a proof: permission check, then a short presigned GET on the private bucket */
export const GET: RequestHandler = async ({ locals, params, setHeaders }) => {
	requirePerm(locals, 'payments', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Bukti tidak ditemukan.');
	const key = await proofKey(db, params.id);
	if (!key) error(404, 'Bukti tidak ditemukan.');
	setHeaders({ 'cache-control': 'private, no-store' });
	// The presigned URL is on the storage host, so the redirect is external
	redirect(303, await requireStorage().downloadUrl(key, 3600), { external: true });
};
