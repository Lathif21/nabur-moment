import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { embedCoverSchema } from '#lib/schemas/media.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import {
	createEmbedCoverUpload,
	mediaByIds,
	removeEmbedCover,
	setEmbedCover
} from '#lib/server/services/media.ts';
import { publicPathsFor } from '#lib/server/site.ts';
import { requireStorage } from '#lib/server/storage/index.ts';
import type { RequestHandler } from './$types';

// Cover picture of an embed (Instagram / TikTok give none): POST = a presigned PUT, PUT = the
// file is uploaded, DELETE = no cover. The browser uploads straight to the bucket.

function guard(locals: App.Locals, id: string) {
	requirePerm(locals, 'media', 'update');
	if (!z.uuid().safeParse(id).success) error(404, 'Media tidak ditemukan.');
}

async function run<T>(fn: () => Promise<T>) {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
}

/** The item with its usage count; refreshes the public pages when it is on one */
async function done(id: string) {
	const [row] = await mediaByIds(db, [id]);
	if (!row) error(404, 'Media tidak ditemukan.');
	// Media rows are read live, so a used cover shows once the cached pages are rebuilt
	if (row.usage > 0) await revalidate(await publicPathsFor());
	return json(toMediaItem(row, requireStorage()));
}

export const POST: RequestHandler = async ({ locals, params }) => {
	guard(locals, params.id);
	return json(await run(() => createEmbedCoverUpload(db, requireStorage(), params.id)));
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	guard(locals, params.id);
	const parsed = embedCoverSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Data sampul tidak valid.');
	await run(() => setEmbedCover(db, requireStorage(), params.id, parsed.data));
	return done(params.id);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	guard(locals, params.id);
	await run(() => removeEmbedCover(db, requireStorage(), params.id));
	return done(params.id);
};
