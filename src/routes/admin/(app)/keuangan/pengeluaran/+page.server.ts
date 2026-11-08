import { can } from '#lib/permissions.ts';
import { expenseFilterSchema } from '#lib/schemas/finance.ts';
import { deleteExpenseAction, saveExpenseAction } from '#lib/server/actions/expenses.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import {
	expenseBookingOptions,
	listExpenseCategories,
	listExpenses
} from '#lib/server/services/expenses.ts';
import type { Actions, PageServerLoad } from './$types';

// Pengeluaran (03-SCREENS B6): list (month, category, Per booking / Overhead, search) + form.
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'expenses', 'read');
	const p = url.searchParams;
	const filter = expenseFilterSchema.parse({
		q: p.get('q') ?? '',
		month: p.get('bulan') || null,
		categoryId: p.get('kategori') || null,
		scope: p.get('jenis') || null
	});
	const perms = locals.perms!;
	const allow = {
		create: can(perms, 'expenses', 'create'),
		update: can(perms, 'expenses', 'update'),
		delete: can(perms, 'expenses', 'delete'),
		bookings: can(perms, 'bookings', 'read')
	};
	const [list, categories, bookings] = await Promise.all([
		listExpenses(db, filter),
		listExpenseCategories(db, { withArchived: true }),
		allow.create || allow.update ? expenseBookingOptions(db) : []
	]);
	return { ...list, filter, categories, bookings, allow };
};

export const actions: Actions = {
	expense: saveExpenseAction,
	delete: deleteExpenseAction
};
