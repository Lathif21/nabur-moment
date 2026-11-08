import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import { paymentFilterSchema } from '#lib/schemas/finance.ts';
import { moveBookingAction } from '#lib/server/actions/bookings.ts';
import { deletePaymentAction, recordPaymentAction } from '#lib/server/actions/payments.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listPayments, payableBookings } from '#lib/server/services/payments.ts';
import type { Actions, PageServerLoad } from './$types';

// Pembayaran (03-SCREENS B6): list (paid month, method, search) and "Catat pembayaran".
// `?booking=<id>` opens the form for that booking (the "Catat pembayaran DP" link on the board).
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'payments', 'read');
	const p = url.searchParams;
	const filter = paymentFilterSchema.parse({
		q: p.get('q') ?? '',
		method: p.get('metode') || null,
		month: p.get('bulan') || null
	});
	const perms = locals.perms!;
	const allow = {
		create: can(perms, 'payments', 'create'),
		delete: can(perms, 'payments', 'delete'),
		bookings: can(perms, 'bookings', 'read')
	};
	const preselect = z.uuid().safeParse(p.get('booking'));
	const [list, bookings] = await Promise.all([
		listPayments(db, filter),
		allow.create ? payableBookings(db) : null
	]);
	return {
		...list,
		filter,
		bookings,
		preselect: preselect.success ? preselect.data : null,
		allow
	};
};

export const actions: Actions = {
	payment: recordPaymentAction,
	delete: deletePaymentAction,
	move: moveBookingAction
};
