import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import {
	addActivityAction,
	deliveryAction,
	moveBookingAction,
	updateBookingAction
} from '#lib/server/actions/bookings.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listActivities } from '#lib/server/services/activity.ts';
import { bookingFormOptions, getBookingDetail } from '#lib/server/services/bookings.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking page (03-SCREENS B4): header + stage, sessions, package + add-ons, payment / cost
// placeholders until Phase 3, delivery, notes, activity composer + timeline.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'bookings', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Booking tidak ditemukan.');
	const perms = locals.perms!;
	const allow = {
		update: can(perms, 'bookings', 'update'),
		newClient: can(perms, 'clients', 'create'),
		payments: can(perms, 'payments', 'create')
	};
	const [found, activities, options] = await Promise.all([
		getBookingDetail(db, params.id),
		listActivities(db, { bookingId: params.id }),
		allow.update ? bookingFormOptions(db) : null
	]);
	if (!found) error(404, 'Booking tidak ditemukan.');
	return { booking: found, activities, options, allow };
};

export const actions: Actions = {
	update: updateBookingAction,
	move: moveBookingAction,
	activity: addActivityAction,
	delivery: deliveryAction
};
