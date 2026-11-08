// Expense form actions shared by the Pengeluaran list and the booking page ("Tambah biaya"), and
// the category actions of Pengaturan → Bisnis & Keuangan.
import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import {
	expenseCategoryArchiveSchema,
	expenseCategorySchema,
	expenseIdSchema,
	expenseSchema
} from '#lib/schemas/finance.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { ServiceError } from '#lib/server/services/errors.ts';
import {
	createExpense,
	deleteExpense,
	deleteExpenseCategory,
	saveExpenseCategory,
	setExpenseCategoryArchived,
	updateExpense
} from '#lib/server/services/expenses.ts';
import { PRIVATE_BUCKET, storage } from '#lib/server/storage/index.ts';

type Event = Pick<RequestEvent, 'request' | 'locals'>;

function serviceFail(e: unknown) {
	if (!(e instanceof ServiceError)) throw e;
	return fail(400, { error: e.message, fields: e.field ? { [e.field]: e.message } : {} });
}

/** Removing a replaced / deleted receipt file is best effort (the row is already gone) */
async function removeFile(key: string | null) {
	if (key && storage) await storage.remove(PRIVATE_BUCKET, [key]).catch(() => {});
}

/** Create, or update when the form carries an id */
export async function saveExpenseAction({ request, locals }: Event) {
	const form = formObject(await request.formData());
	const id = form.id ? z.uuid().safeParse(form.id) : null;
	if (id && !id.success) return fail(400, { error: 'Pengeluaran tidak valid.' });
	const me = requirePerm(locals, 'expenses', id ? 'update' : 'create');
	const parsed = expenseSchema.safeParse(form);
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		if (id) {
			const r = await updateExpense(db, id.data, parsed.data);
			await removeFile(r.removedKey);
			return { done: 'Pengeluaran disimpan.' };
		}
		await createExpense(db, parsed.data, me.id);
		return { done: 'Pengeluaran dicatat.' };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function deleteExpenseAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'expenses', 'delete');
	const parsed = expenseIdSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Pengeluaran tidak valid.' });
	try {
		const r = await deleteExpense(db, parsed.data.id, me.id);
		await removeFile(r.removedKey);
		return { done: 'Pengeluaran dihapus.' };
	} catch (e) {
		return serviceFail(e);
	}
}

// ---------- categories (Pengaturan → Bisnis & Keuangan) ----------

export async function saveCategoryAction({ request, locals }: Event) {
	const parsed = expenseCategorySchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	requirePerm(locals, 'business_settings', parsed.data.id ? 'update' : 'create');
	try {
		await saveExpenseCategory(db, parsed.data);
		return { done: parsed.data.id ? 'Kategori diubah.' : 'Kategori ditambahkan.' };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function archiveCategoryAction({ request, locals }: Event) {
	requirePerm(locals, 'business_settings', 'update');
	const parsed = expenseCategoryArchiveSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Kategori tidak valid.' });
	try {
		await setExpenseCategoryArchived(db, parsed.data.id, parsed.data.archived);
		return { done: parsed.data.archived ? 'Kategori diarsipkan.' : 'Kategori diaktifkan lagi.' };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function deleteCategoryAction({ request, locals }: Event) {
	requirePerm(locals, 'business_settings', 'delete');
	const parsed = expenseIdSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Kategori tidak valid.' });
	try {
		await deleteExpenseCategory(db, parsed.data.id);
		return { done: 'Kategori dihapus.' };
	} catch (e) {
		return serviceFail(e);
	}
}
