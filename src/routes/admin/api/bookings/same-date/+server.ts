import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { sameDateBookings } from '#lib/server/services/bookings.ts';
import type { RequestHandler } from './$types';

/** ?d=yyyy-MM-dd&d=…&except=<bookingId>: other bookings on those dates (warning, never a block) */
export const GET: RequestHandler = async ({ locals, url }) => {
	requirePerm(locals, 'bookings', 'read');
	const dates = url.searchParams.getAll('d').slice(0, 20);
	const except = url.searchParams.get('except');
	const exceptId = except && z.uuid().safeParse(except).success ? except : null;
	return json(await sameDateBookings(db, dates, exceptId));
};
