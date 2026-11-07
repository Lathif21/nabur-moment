import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isPageKey } from '#lib/cms/sections.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { saveSectionDraft } from '#lib/server/services/cms-pages.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import type { RequestHandler } from './$types';

const body = z.object({ data: z.record(z.string(), z.unknown()), visible: z.boolean() });

/** Autosave of one section's draft */
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requirePerm(locals, 'cms_pages', 'update');
	if (!isPageKey(params.page)) error(404, 'Halaman tidak ditemukan.');
	const parsed = body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, 'Data tidak valid.');
	try {
		const saved = await saveSectionDraft(db, params.page, params.key, parsed.data, user.id);
		return json({ dirty: saved.dirty });
	} catch (e) {
		if (e instanceof ServiceError) error(400, e.message);
		throw e;
	}
};
