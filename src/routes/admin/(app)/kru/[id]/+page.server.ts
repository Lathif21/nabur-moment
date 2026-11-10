import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { resolvePeriod } from '#lib/period.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { crewJobs, getCrew } from '#lib/server/services/crew.ts';
import type { PageServerLoad } from './$types';

// One crew member: the bookings they handle in the period (booked onward, never Batal, by Hari H)
export const load: PageServerLoad = async ({ locals, params, url }) => {
	requirePerm(locals, 'crew', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Kru tidak ditemukan.');
	const crew = await getCrew(db, params.id);
	if (!crew) error(404, 'Kru tidak ditemukan.');
	const p = url.searchParams;
	const period = resolvePeriod({ period: p.get('period'), from: p.get('from'), to: p.get('to') });
	return {
		crew,
		period,
		jobs: await crewJobs(db, crew.id, period),
		allow: {
			bookings: locals.perms!.has('bookings:read'),
			clients: locals.perms!.has('clients:read')
		}
	};
};
