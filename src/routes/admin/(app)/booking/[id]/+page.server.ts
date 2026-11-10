import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { can } from '#lib/permissions.ts';
import {
	createCustomInvoiceAction,
	createInstallmentInvoiceAction
} from '#lib/server/actions/invoices.ts';
import { deletePaymentAction, recordPaymentAction } from '#lib/server/actions/payments.ts';
import { deleteExpenseAction, saveExpenseAction } from '#lib/server/actions/expenses.ts';
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
import { listBookingExpenses, listExpenseCategories } from '#lib/server/services/expenses.ts';
import type { Actions, PageServerLoad } from './$types';

// Booking page (03-SCREENS B4): header + stage, sessions, package + add-ons, payment schedule
// (P3-01), invoices (P3-02), payments (P3-04), direct costs + profit (P3-05), delivery, notes,
// activity composer + timeline.
export const load: PageServerLoad = async ({ locals, params }) => {
	requirePerm(locals, 'bookings', 'read');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Booking tidak ditemukan.');
	const perms = locals.perms!;
	const allow = {
		update: can(perms, 'bookings', 'update'),
		newClient: can(perms, 'clients', 'create'),
		crew: can(perms, 'crew', 'read'),
		payments: can(perms, 'payments', 'create'),
		deletePayments: can(perms, 'payments', 'delete'),
		expenses: {
			read: can(perms, 'expenses', 'read'),
			create: can(perms, 'expenses', 'create'),
			update: can(perms, 'expenses', 'update'),
			delete: can(perms, 'expenses', 'delete')
		},
		invoices: {
			read: can(perms, 'invoices', 'read'),
			create: can(perms, 'invoices', 'create')
		}
	};
	await refreshOverdue(db);
	const canWriteExpense = allow.expenses.create || allow.expenses.update;
	const [found, activities, schedule, invoices, payments, expenses, categories, options] =
		await Promise.all([
			getBookingDetail(db, params.id),
			listActivities(db, { bookingId: params.id }),
			listSchedule(db, params.id),
			listBookingInvoices(db, params.id),
			listBookingPayments(db, params.id),
			allow.expenses.read ? listBookingExpenses(db, params.id) : [],
			canWriteExpense ? listExpenseCategories(db, { withArchived: true }) : null,
			allow.update ? bookingFormOptions(db) : null
		]);
	if (!found) error(404, 'Booking tidak ditemukan.');
	return {
		booking: found,
		activities,
		schedule,
		invoices,
		payments,
		expenses,
		categories,
		options,
		allow
	};
};

export const actions: Actions = {
	update: updateBookingAction,
	move: moveBookingAction,
	activity: addActivityAction,
	delivery: deliveryAction,
	invoice: createInstallmentInvoiceAction,
	customInvoice: createCustomInvoiceAction,
	payment: recordPaymentAction,
	deletePayment: deletePaymentAction,
	expense: saveExpenseAction,
	deleteExpense: deleteExpenseAction
};
