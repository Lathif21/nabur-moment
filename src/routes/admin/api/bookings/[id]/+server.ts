import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { getBookingForEdit } from '#lib/server/services/bookings.ts';
import type { RequestHandler } from './$types';

/** Booking with sessions and add-on lines, for the edit drawer */
export const GET: RequestHandler = async ({ locals, params }) => {
	requirePerm(locals, 'bookings', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Booking tidak ditemukan.');
	const found = await getBookingForEdit(db, params.id);
	if (!found) error(404, 'Booking tidak ditemukan.');
	return json(found);
};
