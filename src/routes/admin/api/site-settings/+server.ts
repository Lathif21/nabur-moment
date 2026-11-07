import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import { saveSiteSettingsDraft } from '#lib/server/services/site-settings.ts';
import type { RequestHandler } from './$types';

const body = z.object({ data: z.record(z.string(), z.unknown()) });

/** Autosave of the site settings draft */
export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = requirePerm(locals, 'site_settings', 'update');
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Data tidak valid.');
	try {
		const saved = await saveSiteSettingsDraft(db, parsed.data.data, user.id);
		return json({ dirty: saved.dirty });
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
