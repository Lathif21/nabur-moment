import { can } from '#lib/permissions.ts';
import { bookingFilterSchema } from '#lib/schemas/crm.ts';
import { createBookingAction } from '#lib/server/actions/bookings.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { bookingFormOptions, listBookings } from '#lib/server/services/bookings.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking list (03-SCREENS B4): search, stage, event type and session-month filters.
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'bookings', 'read');
	const p = url.searchParams;
	const filter = bookingFilterSchema.parse({
		q: p.get('q') ?? '',
		stage: p.get('tahap') || null,
		eventType: p.get('jenis') || null,
		month: p.get('bulan') || null
	});
	const [rows, options] = await Promise.all([listBookings(db, filter), bookingFormOptions(db)]);
	const perms = locals.perms!;
	return {
		rows,
		filter,
		options,
		allow: {
			create: can(perms, 'bookings', 'create'),
			newClient: can(perms, 'clients', 'create')
		}
	};
};

export const actions: Actions = {
	create: createBookingAction
};
