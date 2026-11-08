import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import {
	createCustomInvoiceAction,
	createInstallmentInvoiceAction
} from '#lib/server/actions/invoices.ts';
import { deletePaymentAction, recordPaymentAction } from '#lib/server/actions/payments.ts';
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
import { listSchedule } from '#lib/server/services/installments.ts';
import { listBookingInvoices, refreshOverdue } from '#lib/server/services/invoices.ts';
import { listBookingPayments } from '#lib/server/services/payments.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking page (03-SCREENS B4): header + stage, sessions, package + add-ons, payment schedule
// (P3-01), invoices (P3-02), payments (P3-04; direct costs arrive with P3-05), delivery, notes,
// activity composer + timeline.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'bookings', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Booking tidak ditemukan.');
	const perms = locals.perms!;
	const allow = {
		update: can(perms, 'bookings', 'update'),
		newClient: can(perms, 'clients', 'create'),
		payments: can(perms, 'payments', 'create'),
		deletePayments: can(perms, 'payments', 'delete'),
		invoices: {
			read: can(perms, 'invoices', 'read'),
			create: can(perms, 'invoices', 'create')
		}
	};
	await refreshOverdue(db);
	const [found, activities, schedule, invoices, payments, options] = await Promise.all([
		getBookingDetail(db, params.id),
		listActivities(db, { bookingId: params.id }),
		listSchedule(db, params.id),
		listBookingInvoices(db, params.id),
		listBookingPayments(db, params.id),
		allow.update ? bookingFormOptions(db) : null
	]);
	if (!found) error(404, 'Booking tidak ditemukan.');
	return { booking: found, activities, schedule, invoices, payments, options, allow };
};

export const actions: Actions = {
	update: updateBookingAction,
	move: moveBookingAction,
	activity: addActivityAction,
	delivery: deliveryAction,
	invoice: createInstallmentInvoiceAction,
	customInvoice: createCustomInvoiceAction,
	payment: recordPaymentAction,
	deletePayment: deletePaymentAction
};
