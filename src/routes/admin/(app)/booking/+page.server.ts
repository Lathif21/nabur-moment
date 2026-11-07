import { can } from '#lib/permissions.ts';
import {
	createBookingAction,
	moveBookingAction,
	updateBookingAction
} from '#lib/server/actions/bookings.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { bookingFormOptions, listBoard } from '#lib/server/services/bookings.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking board (03-SCREENS B4): 9 columns, drag or "Pindah ke…", new / edit drawer.
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'bookings', 'read');
	const [cards, options] = await Promise.all([listBoard(db), bookingFormOptions(db)]);
	const perms = locals.perms!;
	return {
		cards,
		options,
		allow: {
			create: can(perms, 'bookings', 'create'),
			update: can(perms, 'bookings', 'update'),
			newClient: can(perms, 'clients', 'create'),
			payments: can(perms, 'payments', 'create')
		}
	};
};

export const actions: Actions = {
	create: createBookingAction,
	update: updateBookingAction,
	move: moveBookingAction
};
