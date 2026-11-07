import { error, json } from '@sveltejs/kit';
import { mediaListQuery, uploadSchema } from '#lib/schemas/media.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { createUpload, listMedia } from '#lib/server/services/media.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

/** The picker's grid: GET ?kind=image&unused=1 */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePerm(locals, 'media', 'read');
	const q = mediaListQuery.parse(Object.fromEntries(url.searchParams));
	const storage = requireStorage();
	const rows = await listMedia(db, { kind: q.kind, unused: q.unused, limit: 120 });
	return json(rows.map((r) => toMediaItem(r, storage)));
};

/** Upload step 1: a pending row + presigned PUTs; the browser then uploads straight to the bucket */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requirePerm(locals, 'media', 'create');
	const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Data unggahan tidak valid.');
	try {
		return json(await createUpload(db, requireStorage(), parsed.data, user.id));
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
