import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { confirmUpload } from '#lib/server/services/media.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

/** Upload step 2: every file is in the bucket → the item is ready */
export const POST: RequestHandler = async ({ locals, params }) => {
	requirePerm(locals, 'media', 'create');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Media tidak ditemukan.');
	const storage = requireStorage();
	try {
		const row = await confirmUpload(db, storage, params.id);
		return json(toMediaItem({ ...row, usage: 0 }, storage));
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
