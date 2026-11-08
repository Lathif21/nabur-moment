// Expenses (P3-05, 02-DATA-MODEL expense / expense_category): money out, a direct cost of a
// booking or overhead (no booking). Booking profit = its payments − its expenses. Every function
// takes `db` or an open transaction first.
import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import { generateKeyBetween } from 'fractional-indexing';
import type { DbOrTx } from '../db/client.ts';
import { activity, booking, client, expense, expenseCategory, media } from '../db/schema/index.ts';
import { rupiah } from '../../format.ts';
import type { ExpenseFilter, ExpenseInput } from '../../schemas/finance.ts';
import { PRIVATE_BUCKET } from '../storage/files.ts';
import { ServiceError } from './errors.ts';
import { bookingPaid } from './payments.ts';

const sumAmount = sql<number>`coalesce(sum(${expense.amount}), 0)::bigint`.mapWith(Number);

// ---------- categories ----------

/** For selects and the settings card: active ones, plus an archived one still referenced */
export async function listExpenseCategories(
	db: DbOrTx,
	opts: { withArchived?: boolean; keepId?: string | null } = {}
) {
	return db
		.select({
			id: expenseCategory.id,
			name: expenseCategory.name,
			archived: expenseCategory.archived,
			used: sql<number>`(select count(*) from "expense" e where e.category_id = "expense_category"."id")::int`
		})
		.from(expenseCategory)
		.where(
			opts.withArchived
				? undefined
				: or(
						eq(expenseCategory.archived, false),
						opts.keepId ? eq(expenseCategory.id, opts.keepId) : undefined
					)
		)
		.orderBy(asc(expenseCategory.position), asc(expenseCategory.name));
}

async function uniqueName(db: DbOrTx, name: string, exceptId?: string | null) {
	const [dup] = await db
		.select({ id: expenseCategory.id })
		.from(expenseCategory)
		.where(
			and(
				sql`lower(${expenseCategory.name}) = lower(${name})`,
				exceptId ? ne(expenseCategory.id, exceptId) : undefined
			)
		);
	if (dup) throw new ServiceError('Kategori dengan nama itu sudah ada.', 'name');
}

/** Add at the bottom, or rename */
export async function saveExpenseCategory(db: DbOrTx, input: { id: string | null; name: string }) {
	await uniqueName(db, input.name, input.id);
	if (input.id) {
		const [row] = await db
			.update(expenseCategory)
			.set({ name: input.name })
			.where(eq(expenseCategory.id, input.id))
			.returning();
		if (!row) throw new ServiceError('Kategori tidak ditemukan.');
		return row;
	}
	const [last] = await db
		.select({ position: expenseCategory.position })
		.from(expenseCategory)
		.orderBy(desc(expenseCategory.position))
		.limit(1);
	const [row] = await db
		.insert(expenseCategory)
		.values({ name: input.name, position: generateKeyBetween(last?.position ?? null, null) })
		.returning();
	return row;
}

export async function setExpenseCategoryArchived(db: DbOrTx, id: string, archived: boolean) {
	const [row] = await db
		.update(expenseCategory)
		.set({ archived })
		.where(eq(expenseCategory.id, id))
		.returning();
	if (!row) throw new ServiceError('Kategori tidak ditemukan.');
	return row;
}

/** Delete only when no expense uses it (otherwise archive) */
export async function deleteExpenseCategory(db: DbOrTx, id: string) {
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(expense)
		.where(eq(expense.categoryId, id));
	if (n > 0)
		throw new ServiceError(
			`Kategori ini dipakai ${n} pengeluaran. Arsipkan saja agar tidak muncul lagi.`
		);
	const [row] = await db.delete(expenseCategory).where(eq(expenseCategory.id, id)).returning();
	if (!row) throw new ServiceError('Kategori tidak ditemukan.');
	return row;
}

// ---------- expenses ----------

async function checkRefs(db: DbOrTx, input: ExpenseInput, currentCategoryId?: string) {
	const [cat] = await db
		.select({ archived: expenseCategory.archived })
		.from(expenseCategory)
		.where(eq(expenseCategory.id, input.categoryId));
	if (!cat || (cat.archived && input.categoryId !== currentCategoryId))
		throw new ServiceError('Pilih kategori yang aktif.', 'categoryId');
	let b: { clientId: string; title: string } | undefined;
	if (input.bookingId) {
		[b] = await db
			.select({ clientId: booking.clientId, title: booking.title })
			.from(booking)
			.where(eq(booking.id, input.bookingId));
		if (!b) throw new ServiceError('Booking tidak ditemukan.', 'bookingId');
	}
	if (input.receiptMediaId) {
		const [m] = await db
			.select({ bucket: media.bucket, status: media.status })
			.from(media)
			.where(eq(media.id, input.receiptMediaId));
		if (!m || m.bucket !== PRIVATE_BUCKET || m.status !== 'ready')
			throw new ServiceError('Nota belum selesai diunggah.', 'receiptMediaId');
	}
	return b;
}

async function logExpense(
	db: DbOrTx,
	b: { clientId: string } | undefined,
	bookingId: string | null,
	body: string,
	userId: string | null
) {
	// Overhead has no client / booking timeline to log on
	if (!b || !bookingId) return;
	await db.insert(activity).values({
		clientId: b.clientId,
		bookingId,
		type: 'expense',
		body,
		userId,
		occurredAt: new Date()
	});
}

export async function createExpense(db: DbOrTx, input: ExpenseInput, userId: string | null) {
	return db.transaction(async (tx) => {
		const b = await checkRefs(tx, input);
		const [row] = await tx
			.insert(expense)
			.values({ ...input, createdBy: userId })
			.returning();
		await logExpense(
			tx,
			b,
			input.bookingId,
			`Biaya ${rupiah(input.amount)}${input.description ? `: ${input.description}` : ''}`,
			userId
		);
		return row;
	});
}

/** Edit; a replaced receipt's media row is removed and its key returned for storage cleanup */
export async function updateExpense(db: DbOrTx, id: string, input: ExpenseInput) {
	return db.transaction(async (tx) => {
		const [current] = await tx.select().from(expense).where(eq(expense.id, id)).for('update');
		if (!current) throw new ServiceError('Pengeluaran tidak ditemukan.');
		await checkRefs(tx, input, current.categoryId);
		const [row] = await tx.update(expense).set(input).where(eq(expense.id, id)).returning();
		let removedKey: string | null = null;
		if (current.receiptMediaId && current.receiptMediaId !== input.receiptMediaId)
			removedKey = await dropReceipt(tx, current.receiptMediaId);
		return { row, removedKey };
	});
}

async function dropReceipt(tx: DbOrTx, mediaId: string) {
	const [m] = await tx
		.delete(media)
		.where(and(eq(media.id, mediaId), eq(media.bucket, PRIVATE_BUCKET)))
		.returning({ key: media.key });
	return m?.key ?? null;
}

/** Delete; returns the receipt key to remove from storage */
export async function deleteExpense(db: DbOrTx, id: string, userId: string | null) {
	return db.transaction(async (tx) => {
		const [current] = await tx.select().from(expense).where(eq(expense.id, id)).for('update');
		if (!current) throw new ServiceError('Pengeluaran tidak ditemukan.');
		await tx.delete(expense).where(eq(expense.id, id));
		const removedKey = current.receiptMediaId
			? await dropReceipt(tx, current.receiptMediaId)
			: null;
		if (current.bookingId) {
			const [b] = await tx
				.select({ clientId: booking.clientId })
				.from(booking)
				.where(eq(booking.id, current.bookingId));
			await logExpense(tx, b, current.bookingId, `Biaya ${rupiah(current.amount)} dihapus`, userId);
		}
		return { removedKey };
	});
}

const expenseColumns = {
	id: expense.id,
	spentOn: expense.spentOn,
	amount: expense.amount,
	description: expense.description,
	method: expense.method,
	receiptMediaId: expense.receiptMediaId,
	categoryId: expense.categoryId,
	categoryName: expenseCategory.name,
	bookingId: expense.bookingId
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Pengeluaran list: newest first, with the total of what is shown */
export async function listExpenses(db: DbOrTx, f: Partial<ExpenseFilter> = {}) {
	const where: SQL[] = [];
	const q = f.q?.trim();
	if (q) {
		const like = `%${likeEscape(q)}%`;
		where.push(
			or(
				ilike(expense.description, like),
				ilike(booking.title, like),
				ilike(client.name, like),
				ilike(expenseCategory.name, like)
			)!
		);
	}
	if (f.month) where.push(sql`to_char(${expense.spentOn}, 'YYYY-MM') = ${f.month}`);
	if (f.categoryId) where.push(eq(expense.categoryId, f.categoryId));
	if (f.scope === 'overhead') where.push(isNull(expense.bookingId));
	if (f.scope === 'booking') where.push(isNotNull(expense.bookingId));
	const rows = await db
		.select({ ...expenseColumns, bookingTitle: booking.title, clientName: client.name })
		.from(expense)
		.innerJoin(expenseCategory, eq(expenseCategory.id, expense.categoryId))
		.leftJoin(booking, eq(booking.id, expense.bookingId))
		.leftJoin(client, eq(client.id, booking.clientId))
		.where(and(...where))
		.orderBy(desc(expense.spentOn), desc(expense.createdAt))
		.limit(500);
	return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/** Direct costs of one booking (booking page) */
export async function listBookingExpenses(db: DbOrTx, bookingId: string) {
	return db
		.select(expenseColumns)
		.from(expense)
		.innerJoin(expenseCategory, eq(expenseCategory.id, expense.categoryId))
		.where(eq(expense.bookingId, bookingId))
		.orderBy(asc(expense.spentOn), asc(expense.createdAt));
}

export type ExpenseRow = Awaited<ReturnType<typeof listBookingExpenses>>[number];

/** Booking profit (01-PRD): paid income − direct expenses */
export async function bookingProfit(db: DbOrTx, bookingId: string) {
	const [paid, [{ costs }]] = await Promise.all([
		bookingPaid(db, bookingId),
		db.select({ costs: sumAmount }).from(expense).where(eq(expense.bookingId, bookingId))
	]);
	return { paid, costs, profit: paid - costs };
}

/** Bookings an expense can belong to (Batal too: money already spent), newest first */
export async function expenseBookingOptions(db: DbOrTx) {
	return db
		.select({ id: booking.id, title: booking.title, clientName: client.name })
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.orderBy(desc(booking.createdAt))
		.limit(1000);
}
