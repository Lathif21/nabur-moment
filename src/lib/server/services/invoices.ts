// Invoices (P3-02, 01-PRD Phase 3, 02-DATA-MODEL invoice / counter): numbering, create from an
// installment or custom lines, sent / void, overdue, list + page. Never deleted: voided.
// `partial` / `paid` come only from payments (P3-04). Every function takes `db` or a transaction.
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import {
	activity,
	addon,
	booking,
	bookingAddon,
	bookingInstallment,
	client,
	counter,
	invoice,
	payment,
	type InvoiceItem
} from '../db/schema/index.ts';
import {
	INSTALLMENT_LABEL,
	counterKey,
	docNumber,
	itemsTotal,
	type InvoiceStatus
} from '../../finance.ts';
import { dayKeyWib, rupiah } from '../../format.ts';
import type {
	CustomInvoiceInput,
	InstallmentInvoiceInput,
	InvoiceFilter
} from '../../schemas/finance.ts';
import { ServiceError } from './errors.ts';

/**
 * Next number of the document's month, e.g. INV/NM/2026/11/007. One atomic upsert on the month's
 * counter row: concurrent transactions queue on that row, so numbers never repeat. Run it inside
 * the transaction that writes the document, so a failed insert gives the number back.
 */
export async function nextNumber(tx: DbOrTx, kind: 'INV' | 'KW', date: string) {
	const [row] = await tx
		.insert(counter)
		.values({ key: counterKey(kind, date), value: 1 })
		.onConflictDoUpdate({ target: counter.key, set: { value: sql`${counter.value} + 1` } })
		.returning({ value: counter.value });
	return docNumber(kind, date, row.value);
}

/** Money already received on an invoice (payments arrive in P3-04) */
const paidSql = sql<number>`(select coalesce(sum(p.amount), 0) from "payment" p where p.invoice_id = "invoice"."id")::bigint`;

async function bookingForInvoice(tx: DbOrTx, bookingId: string) {
	const [b] = await tx
		.select({
			id: booking.id,
			clientId: booking.clientId,
			title: booking.title,
			stage: booking.stage,
			agreedPrice: booking.agreedPrice,
			packageSnapshot: booking.packageSnapshot
		})
		.from(booking)
		.where(eq(booking.id, bookingId))
		.for('update');
	if (!b) throw new ServiceError('Booking tidak ditemukan.');
	if (b.stage === 'lost') throw new ServiceError('Booking ini sudah batal, tidak bisa ditagih.');
	return b;
}

/**
 * Contract lines for an installment invoice: the package and the add-ons (no discounts). When the
 * agreed price was edited by hand they no longer add up, so one line carries the agreed price.
 */
async function contractItems(
	tx: DbOrTx,
	b: Pick<
		Awaited<ReturnType<typeof bookingForInvoice>>,
		'id' | 'title' | 'agreedPrice' | 'packageSnapshot'
	>
): Promise<InvoiceItem[]> {
	const addons = await tx
		.select({
			name: bookingAddon.name,
			unitPrice: bookingAddon.unitPrice,
			qty: bookingAddon.qty,
			// The add-on list's description (none for a line typed on the booking)
			description: addon.description
		})
		.from(bookingAddon)
		.leftJoin(addon, eq(addon.id, bookingAddon.addonId))
		.where(eq(bookingAddon.bookingId, b.id))
		.orderBy(asc(bookingAddon.createdAt));
	// What the package includes, as stored on the booking when it was picked
	const inclusions = (b.packageSnapshot?.inclusions ?? []).map((s) => s.trim()).filter(Boolean);
	const withDetails = (details: string[]) => (details.length ? { details } : {});
	const lines: InvoiceItem[] = [
		...(b.packageSnapshot
			? [
					{
						description: `Paket ${b.packageSnapshot.name}`,
						qty: 1,
						unitPrice: b.packageSnapshot.price,
						...withDetails(inclusions)
					}
				]
			: []),
		...addons.map((a) => ({
			description: `Add-on: ${a.name}`,
			qty: a.qty,
			unitPrice: a.unitPrice,
			...withDetails(a.description?.trim() ? [a.description.trim()] : [])
		}))
	];
	if (lines.length && itemsTotal(lines) === b.agreedPrice) return lines;
	const label = b.packageSnapshot ? `Paket ${b.packageSnapshot.name}` : 'Jasa dokumentasi';
	return [
		{
			description: `${label}${addons.length ? ' + add-on' : ''} (${b.title}), harga disepakati`,
			qty: 1,
			unitPrice: b.agreedPrice,
			// Prices no longer add up, but the client still sees what the deal covers
			...withDetails([...inclusions, ...addons.map((a) => `Add-on: ${a.name}`)])
		}
	];
}

/** The contract lines of a booking as they would be billed now (kwitansi without an invoice) */
export async function bookingContractLines(db: DbOrTx, bookingId: string) {
	const [b] = await db
		.select({
			id: booking.id,
			title: booking.title,
			agreedPrice: booking.agreedPrice,
			packageSnapshot: booking.packageSnapshot
		})
		.from(booking)
		.where(eq(booking.id, bookingId));
	return b ? contractItems(db, b) : [];
}

async function logInvoice(
	tx: DbOrTx,
	row: { id: string; number: string; bookingId: string },
	clientId: string,
	body: string,
	userId: string | null
) {
	await tx.insert(activity).values({
		clientId,
		bookingId: row.bookingId,
		type: 'invoice',
		body,
		meta: { invoiceId: row.id, number: row.number },
		userId,
		occurredAt: new Date()
	});
}

/** "Buat invoice" for the DP or the pelunasan: bills what is still unpaid on that installment */
export async function createInstallmentInvoice(
	db: DbOrTx,
	input: InstallmentInvoiceInput,
	userId: string | null
) {
	return db.transaction(async (tx) => {
		const [inst] = await tx
			.select()
			.from(bookingInstallment)
			.where(eq(bookingInstallment.id, input.installmentId))
			.for('update');
		if (!inst) throw new ServiceError('Termin tidak ditemukan.', 'installmentId');
		const b = await bookingForInvoice(tx, inst.bookingId);
		if (inst.cancelledAt) throw new ServiceError('Termin ini sudah dibatalkan.', 'installmentId');

		const [open] = await tx
			.select({ number: invoice.number })
			.from(invoice)
			.where(and(eq(invoice.installmentId, inst.id), ne(invoice.status, 'void')))
			.limit(1);
		if (open)
			throw new ServiceError(
				`Termin ini sudah punya invoice ${open.number}. Batalkan dulu bila ingin membuat ulang.`,
				'installmentId'
			);

		const [{ paid }] = await tx
			.select({ paid: sql<number>`coalesce(sum(${payment.amount}), 0)::bigint`.mapWith(Number) })
			.from(payment)
			.where(eq(payment.installmentId, inst.id));
		const total = inst.amount - paid;
		if (total <= 0) throw new ServiceError('Termin ini sudah lunas.', 'installmentId');

		const number = await nextNumber(tx, 'INV', input.issueDate);
		const [row] = await tx
			.insert(invoice)
			.values({
				number,
				bookingId: b.id,
				installmentId: inst.id,
				issueDate: input.issueDate,
				dueDate: input.dueDate,
				items: await contractItems(tx, b),
				total,
				notes: input.notes,
				createdBy: userId
			})
			.returning();
		await logInvoice(
			tx,
			row,
			b.clientId,
			`Invoice ${number} dibuat: ${INSTALLMENT_LABEL[inst.kind]}, ${rupiah(total)}`,
			userId
		);
		return row;
	});
}

/** Invoice with free lines (extra hours, extra reels…); total = the lines */
export async function createCustomInvoice(
	db: DbOrTx,
	input: CustomInvoiceInput,
	userId: string | null
) {
	return db.transaction(async (tx) => {
		const b = await bookingForInvoice(tx, input.bookingId);
		const items = input.items;
		const total = itemsTotal(items);
		const number = await nextNumber(tx, 'INV', input.issueDate);
		const [row] = await tx
			.insert(invoice)
			.values({
				number,
				bookingId: b.id,
				installmentId: null,
				issueDate: input.issueDate,
				dueDate: input.dueDate,
				items,
				total,
				notes: input.notes,
				createdBy: userId
			})
			.returning();
		await logInvoice(tx, row, b.clientId, `Invoice ${number} dibuat: ${rupiah(total)}`, userId);
		return row;
	});
}

async function lockInvoice(tx: DbOrTx, id: string) {
	const [row] = await tx
		.select({ inv: invoice, clientId: booking.clientId })
		.from(invoice)
		.innerJoin(booking, eq(booking.id, invoice.bookingId))
		.where(eq(invoice.id, id))
		.for('update', { of: invoice });
	if (!row) throw new ServiceError('Invoice tidak ditemukan.');
	return row;
}

/** "Tandai terkirim": the draft is final from here on */
export async function markInvoiceSent(db: DbOrTx, id: string, userId: string | null) {
	return db.transaction(async (tx) => {
		const { inv, clientId } = await lockInvoice(tx, id);
		if (inv.status !== 'draft') throw new ServiceError('Invoice ini sudah dikirim.');
		const today = dayKeyWib();
		const [row] = await tx
			.update(invoice)
			.set({ status: inv.dueDate < today ? 'overdue' : 'sent', sentAt: new Date() })
			.where(eq(invoice.id, id))
			.returning();
		await logInvoice(tx, row, clientId, `Invoice ${row.number} dikirim ke klien`, userId);
		return row;
	});
}

/** "Batalkan (void)": kept with its number; refused once a payment is recorded on it */
export async function voidInvoice(db: DbOrTx, id: string, userId: string | null) {
	return db.transaction(async (tx) => {
		const { inv, clientId } = await lockInvoice(tx, id);
		if (inv.status === 'void') throw new ServiceError('Invoice ini sudah dibatalkan.');
		const [{ n }] = await tx
			.select({ n: sql<number>`count(*)::int` })
			.from(payment)
			.where(eq(payment.invoiceId, id));
		if (n > 0)
			throw new ServiceError(
				'Invoice ini sudah punya pembayaran, jadi tidak bisa dibatalkan. Hapus pembayarannya dulu.'
			);
		const [row] = await tx
			.update(invoice)
			.set({ status: 'void', voidedAt: new Date() })
			.where(eq(invoice.id, id))
			.returning();
		await logInvoice(tx, row, clientId, `Invoice ${row.number} dibatalkan`, userId);
		return row;
	});
}

/**
 * Booking moved to Batal: void every invoice that has no payment yet (draft, sent, overdue). Runs
 * inside the stage-move transaction. Returns the numbers voided.
 */
export async function voidUnpaidInvoices(tx: DbOrTx, bookingId: string) {
	const rows = await tx
		.update(invoice)
		.set({ status: 'void', voidedAt: new Date() })
		.where(
			and(
				eq(invoice.bookingId, bookingId),
				inArray(invoice.status, ['draft', 'sent', 'overdue']),
				// written out: Drizzle leaves ${invoice.id} unqualified inside the subquery
				sql`not exists (select 1 from "payment" p where p.invoice_id = "invoice"."id")`
			)
		)
		.returning({ id: invoice.id, number: invoice.number });
	return rows.map((r) => r.number);
}

/**
 * The daily overdue check, run on read (list, invoice and booking pages; a Vercel Cron can call
 * it too): sent / partial invoices past their due date (WIB) become overdue.
 */
export async function refreshOverdue(db: DbOrTx, today = dayKeyWib()) {
	await db
		.update(invoice)
		.set({ status: 'overdue' })
		.where(and(inArray(invoice.status, ['sent', 'partial']), sql`${invoice.dueDate} < ${today}`));
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** The list: newest first, with a count per status for the filter chips */
export async function listInvoices(db: DbOrTx, f: Partial<InvoiceFilter> = {}) {
	const where: SQL[] = [];
	const q = f.q?.trim();
	if (q) {
		const like = `%${likeEscape(q)}%`;
		where.push(
			or(ilike(invoice.number, like), ilike(client.name, like), ilike(booking.title, like))!
		);
	}
	if (f.month) where.push(sql`to_char(${invoice.issueDate}, 'YYYY-MM') = ${f.month}`);
	const base = and(...where);

	const [counts, rows] = await Promise.all([
		db
			.select({ status: invoice.status, n: sql<number>`count(*)::int` })
			.from(invoice)
			.innerJoin(booking, eq(booking.id, invoice.bookingId))
			.innerJoin(client, eq(client.id, booking.clientId))
			.where(base)
			.groupBy(invoice.status),
		db
			.select({
				id: invoice.id,
				number: invoice.number,
				status: invoice.status,
				issueDate: invoice.issueDate,
				dueDate: invoice.dueDate,
				total: invoice.total,
				paid: paidSql.mapWith(Number),
				installmentKind: bookingInstallment.kind,
				bookingId: booking.id,
				bookingTitle: booking.title,
				clientName: client.name
			})
			.from(invoice)
			.innerJoin(booking, eq(booking.id, invoice.bookingId))
			.innerJoin(client, eq(client.id, booking.clientId))
			.leftJoin(bookingInstallment, eq(bookingInstallment.id, invoice.installmentId))
			.where(and(base, f.status ? eq(invoice.status, f.status) : undefined))
			.orderBy(desc(invoice.issueDate), desc(invoice.number))
			.limit(500)
	]);
	return {
		rows,
		counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<
			Record<InvoiceStatus, number>
		>
	};
}

/** Invoice page: the invoice, its booking + client, the installment and the payments */
export async function getInvoice(db: DbOrTx, id: string) {
	const [row] = await db
		.select({
			id: invoice.id,
			number: invoice.number,
			status: invoice.status,
			issueDate: invoice.issueDate,
			dueDate: invoice.dueDate,
			items: invoice.items,
			total: invoice.total,
			notes: invoice.notes,
			sentAt: invoice.sentAt,
			voidedAt: invoice.voidedAt,
			createdAt: invoice.createdAt,
			paid: paidSql.mapWith(Number),
			installmentKind: bookingInstallment.kind,
			installmentAmount: bookingInstallment.amount,
			booking: {
				id: booking.id,
				title: booking.title,
				agreedPrice: booking.agreedPrice
			},
			client: { id: client.id, name: client.name, phone: client.phone, email: client.email }
		})
		.from(invoice)
		.innerJoin(booking, eq(booking.id, invoice.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.leftJoin(bookingInstallment, eq(bookingInstallment.id, invoice.installmentId))
		.where(eq(invoice.id, id));
	if (!row) return null;
	const payments = await db
		.select({
			id: payment.id,
			receiptNumber: payment.receiptNumber,
			paidOn: payment.paidOn,
			amount: payment.amount,
			method: payment.method
		})
		.from(payment)
		.where(eq(payment.invoiceId, id))
		.orderBy(asc(payment.paidOn), asc(payment.createdAt));
	return { ...row, payments };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

/** Invoices of one booking (booking page), oldest first */
export async function listBookingInvoices(db: DbOrTx, bookingId: string) {
	return db
		.select({
			id: invoice.id,
			number: invoice.number,
			status: invoice.status,
			issueDate: invoice.issueDate,
			dueDate: invoice.dueDate,
			total: invoice.total,
			paid: paidSql.mapWith(Number),
			installmentId: invoice.installmentId,
			installmentKind: bookingInstallment.kind
		})
		.from(invoice)
		.leftJoin(bookingInstallment, eq(bookingInstallment.id, invoice.installmentId))
		.where(eq(invoice.bookingId, bookingId))
		.orderBy(asc(invoice.issueDate), asc(invoice.number));
}

export type BookingInvoice = Awaited<ReturnType<typeof listBookingInvoices>>[number];
