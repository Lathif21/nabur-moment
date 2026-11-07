import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { mediaUsageOf } from '#lib/server/services/media.ts';
import type { RequestHandler } from './$types';

/** "Dipakai di …" for the detail drawer */
export const GET: RequestHandler = async ({ locals, params }) => {
	requirePerm(locals, 'media', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Media tidak ditemukan.');
	return json(await mediaUsageOf(db, params.id));
};
