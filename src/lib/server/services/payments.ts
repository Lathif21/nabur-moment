// Payments (P3-04, 02-DATA-MODEL payment, 04-ARCHITECTURE payments.record): money in for a booking,
// against an invoice or an installment. Every payment has an invoice: paying an installment that
// has none creates it first. Recording runs in one transaction: insert (kwitansi
// number) → invoice status → DP fully paid sets `booked_at` → activity. Every function takes `db`
// or an open transaction first.
import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import {
	activity,
	booking,
	bookingInstallment,
	client,
	invoice,
	media,
	payment
} from '../db/schema/index.ts';
import { BOOKED_STAGES, STAGE_LABEL } from '../../crm.ts';
import {
	INSTALLMENT_LABEL,
	PAYMENT_METHOD_LABEL,
	isFirstInstallment,
	splitPrice,
	suggestedDueDate,
	type InstallmentKind,
	type InvoiceStatus
} from '../../finance.ts';
import { dayKeyWib, rupiah } from '../../format.ts';
import type { PaymentFilter, PaymentInput } from '../../schemas/finance.ts';
import { ServiceError } from './errors.ts';
import { setFirstInstallmentKind, unbilledSql } from './installments.ts';
import { bookingContractLines, insertInstallmentInvoice, nextNumber } from './invoices.ts';
import { PRIVATE_BUCKET } from '../storage/files.ts';

const sumAmount = sql<number>`coalesce(sum(${payment.amount}), 0)::bigint`.mapWith(Number);

/** Money received on a booking (every payment counts, also on a cancelled booking: a kept DP) */
export async function bookingPaid(db: DbOrTx, bookingId: string): Promise<number> {
	const [{ paid }] = await db
		.select({ paid: sumAmount })
		.from(payment)
		.where(eq(payment.bookingId, bookingId));
	return paid;
}

async function installmentPaid(db: DbOrTx, installmentId: string) {
	const [{ paid }] = await db
		.select({ paid: sumAmount })
		.from(payment)
		.where(eq(payment.installmentId, installmentId));
	return paid;
}

async function invoicePaid(db: DbOrTx, invoiceId: string) {
	const [{ paid }] = await db
		.select({ paid: sumAmount })
		.from(payment)
		.where(eq(payment.invoiceId, invoiceId));
	return paid;
}

/**
 * Invoice status from its payments (the only place `partial` / `paid` are set): paid in full →
 * paid; some money → partial (overdue once past due); none → draft or sent / overdue.
 */
export async function syncInvoiceStatus(db: DbOrTx, invoiceId: string, today = dayKeyWib()) {
	const [inv] = await db.select().from(invoice).where(eq(invoice.id, invoiceId));
	if (!inv || inv.status === 'void') return inv?.status ?? null;
	const paid = await invoicePaid(db, invoiceId);
	const late = inv.dueDate < today;
	const status: InvoiceStatus =
		paid >= inv.total
			? 'paid'
			: paid > 0
				? late
					? 'overdue'
					: 'partial'
				: !inv.sentAt
					? 'draft'
					: late
						? 'overdue'
						: 'sent';
	if (status !== inv.status)
		await db.update(invoice).set({ status }).where(eq(invoice.id, invoiceId));
	return status;
}

/**
 * DP fully paid ⇔ `booked_at` set (keeps the calendar and the Booked rule in step). "Lunas
 * sekaligus" counts as booked once DP_PERCENT of it is in.
 */
async function syncBookedAt(db: DbOrTx, bookingId: string, when: Date) {
	const [first] = await db
		.select({
			id: bookingInstallment.id,
			kind: bookingInstallment.kind,
			amount: bookingInstallment.amount
		})
		.from(bookingInstallment)
		.where(
			and(
				eq(bookingInstallment.bookingId, bookingId),
				inArray(bookingInstallment.kind, ['dp', 'full'])
			)
		);
	const [b] = await db
		.select({ bookedAt: booking.bookedAt, stage: booking.stage })
		.from(booking)
		.where(eq(booking.id, bookingId));
	if (!first || !b) return { dpPaidNow: false };
	const needed = first.kind === 'full' ? splitPrice(first.amount).dp : first.amount;
	const full = needed > 0 && (await installmentPaid(db, first.id)) >= needed;
	if (full && !b.bookedAt) {
		await db.update(booking).set({ bookedAt: when }).where(eq(booking.id, bookingId));
		return { dpPaidNow: true };
	}
	if (!full && b.bookedAt) {
		// Deleting a DP payment: only while the booking is still before Booked
		if (BOOKED_STAGES.includes(b.stage))
			throw new ServiceError(
				`Booking ini sudah ${STAGE_LABEL[b.stage]}. Pindahkan dulu ke Penawaran sebelum menghapus pembayaran DP.`
			);
		await db.update(booking).set({ bookedAt: null }).where(eq(booking.id, bookingId));
	}
	return { dpPaidNow: false };
}

async function checkProof(db: DbOrTx, mediaId: string) {
	const [m] = await db
		.select({ bucket: media.bucket, status: media.status })
		.from(media)
		.where(eq(media.id, mediaId));
	if (!m || m.bucket !== PRIVATE_BUCKET || m.status !== 'ready')
		throw new ServiceError('Bukti pembayaran belum selesai diunggah.', 'proofMediaId');
}

/**
 * Record money in. The amount may not exceed what is still open on the invoice / installment.
 * Returns `dpPaidNow` when this payment completed the DP (the UI offers the move to Booked).
 */
export async function recordPayment(db: DbOrTx, input: PaymentInput, userId: string | null) {
	return db.transaction(async (tx) => {
		const [b] = await tx
			.select({ id: booking.id, clientId: booking.clientId, stage: booking.stage })
			.from(booking)
			.where(eq(booking.id, input.bookingId))
			.for('update');
		if (!b) throw new ServiceError('Booking tidak ditemukan.', 'bookingId');
		if (b.stage === 'lost')
			throw new ServiceError('Booking ini sudah batal, pembayaran baru tidak bisa dicatat.');

		let invoiceId: string | null;
		let installmentId: string | null;
		let open: number;
		let label: string;
		/** Unbilled part of an installment: its invoice is created below (every payment has one) */
		let toInvoice: { id: string; kind: InstallmentKind; dueDate: string | null } | null = null;
		if (input.target.kind === 'inv') {
			const [inv] = await tx
				.select()
				.from(invoice)
				.where(eq(invoice.id, input.target.id))
				.for('update');
			if (!inv || inv.bookingId !== b.id)
				throw new ServiceError('Invoice ini bukan milik booking tersebut.', 'target');
			if (inv.status === 'void') throw new ServiceError('Invoice ini sudah dibatalkan.', 'target');
			invoiceId = inv.id;
			installmentId = inv.installmentId;
			open = inv.total - (await invoicePaid(tx, inv.id));
			label = inv.number;
		} else {
			// "Lunas sekaligus": the DP row becomes the whole price first
			if (input.target.kind === 'full') {
				const [first] = await tx
					.select({ bookingId: bookingInstallment.bookingId, kind: bookingInstallment.kind })
					.from(bookingInstallment)
					.where(eq(bookingInstallment.id, input.target.id));
				if (!first || first.bookingId !== b.id || !isFirstInstallment(first.kind))
					throw new ServiceError('Termin ini bukan milik booking tersebut.', 'target');
				await setFirstInstallmentKind(tx, b.id, 'full');
			}
			const [inst] = await tx
				.select({
					id: bookingInstallment.id,
					bookingId: bookingInstallment.bookingId,
					kind: bookingInstallment.kind,
					dueDate: bookingInstallment.dueDate,
					cancelledAt: bookingInstallment.cancelledAt,
					unbilled: unbilledSql.mapWith(Number)
				})
				.from(bookingInstallment)
				.where(eq(bookingInstallment.id, input.target.id))
				.for('update', { of: bookingInstallment });
			if (!inst || inst.bookingId !== b.id)
				throw new ServiceError('Termin ini bukan milik booking tersebut.', 'target');
			if (inst.cancelledAt) throw new ServiceError('Termin ini sudah dibatalkan.', 'target');
			installmentId = inst.id;
			label = INSTALLMENT_LABEL[inst.kind];
			// Pay through the installment's open invoice when it has one, so its status follows;
			// otherwise bill the part not invoiced yet (e.g. an add-on after the pelunasan was paid)
			const invs = await tx
				.select({ id: invoice.id, total: invoice.total })
				.from(invoice)
				.where(and(eq(invoice.installmentId, inst.id), ne(invoice.status, 'void')))
				.orderBy(asc(invoice.issueDate), asc(invoice.number));
			let openInv: { id: string; open: number } | null = null;
			for (const i of invs) {
				const left = i.total - (await invoicePaid(tx, i.id));
				if (left > 0) {
					openInv = { id: i.id, open: left };
					break;
				}
			}
			if (openInv) {
				invoiceId = openInv.id;
				open = openInv.open;
			} else {
				invoiceId = null;
				open = inst.unbilled;
				toInvoice = inst;
			}
		}
		if (open <= 0) throw new ServiceError('Tagihan ini sudah lunas.', 'target');
		if (input.amount > open)
			throw new ServiceError(`Jumlah melebihi sisa tagihan (${rupiah(open)}).`, 'amount');
		if (input.proofMediaId) await checkProof(tx, input.proofMediaId);

		if (toInvoice) {
			// Bills what is still open on the installment, dated the payment day
			const inv = await insertInstallmentInvoice(tx, {
				bookingId: b.id,
				installment: toInvoice,
				total: open,
				issueDate: input.paidOn,
				dueDate: suggestedDueDate(toInvoice.kind, toInvoice.dueDate, input.paidOn),
				userId
			});
			invoiceId = inv.id;
		}

		const receiptNumber = await nextNumber(tx, 'KW', input.paidOn);
		const [row] = await tx
			.insert(payment)
			.values({
				bookingId: b.id,
				invoiceId,
				installmentId,
				receiptNumber,
				paidOn: input.paidOn,
				amount: input.amount,
				method: input.method,
				proofMediaId: input.proofMediaId,
				note: input.note,
				createdBy: userId
			})
			.returning();
		if (invoiceId) await syncInvoiceStatus(tx, invoiceId);
		const now = new Date();
		const { dpPaidNow } = await syncBookedAt(tx, b.id, now);
		await tx.insert(activity).values({
			clientId: b.clientId,
			bookingId: b.id,
			type: 'payment',
			body: `Pembayaran ${receiptNumber}: ${rupiah(input.amount)} untuk ${label} (${PAYMENT_METHOD_LABEL[input.method]})${dpPaidNow ? '. DP lunas.' : ''}`,
			meta: { paymentId: row.id, receiptNumber },
			userId,
			occurredAt: now
		});
		return { ...row, dpPaidNow };
	});
}

/**
 * Delete a payment (a typo, a bounced transfer). Reverses the invoice status; clearing a paid DP
 * is refused once the booking is Booked or later. Returns the proof's key to remove from storage.
 */
export async function deletePayment(db: DbOrTx, id: string, userId: string | null) {
	return db.transaction(async (tx) => {
		const [p] = await tx.select().from(payment).where(eq(payment.id, id)).for('update');
		if (!p) throw new ServiceError('Pembayaran tidak ditemukan.');
		const [b] = await tx
			.select({ clientId: booking.clientId })
			.from(booking)
			.where(eq(booking.id, p.bookingId))
			.for('update');
		await tx.delete(payment).where(eq(payment.id, id));
		if (p.invoiceId) await syncInvoiceStatus(tx, p.invoiceId);
		await syncBookedAt(tx, p.bookingId, new Date());

		let proofKey: string | null = null;
		if (p.proofMediaId) {
			const [m] = await tx
				.delete(media)
				.where(and(eq(media.id, p.proofMediaId), eq(media.bucket, PRIVATE_BUCKET)))
				.returning({ key: media.key });
			proofKey = m?.key ?? null;
		}
		await tx.insert(activity).values({
			clientId: b.clientId,
			bookingId: p.bookingId,
			type: 'payment',
			body: `Pembayaran ${p.receiptNumber} (${rupiah(p.amount)}) dihapus`,
			meta: { receiptNumber: p.receiptNumber },
			userId,
			occurredAt: new Date()
		});
		return { receiptNumber: p.receiptNumber, proofKey };
	});
}

const paymentColumns = {
	id: payment.id,
	receiptNumber: payment.receiptNumber,
	paidOn: payment.paidOn,
	amount: payment.amount,
	method: payment.method,
	note: payment.note,
	proofMediaId: payment.proofMediaId,
	invoiceId: payment.invoiceId,
	invoiceNumber: invoice.number,
	installmentKind: bookingInstallment.kind
};

/** Payments of one booking (booking page), oldest first */
export async function listBookingPayments(db: DbOrTx, bookingId: string) {
	return db
		.select(paymentColumns)
		.from(payment)
		.leftJoin(invoice, eq(invoice.id, payment.invoiceId))
		.leftJoin(bookingInstallment, eq(bookingInstallment.id, payment.installmentId))
		.where(eq(payment.bookingId, bookingId))
		.orderBy(asc(payment.paidOn), asc(payment.createdAt));
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Pembayaran list: newest first, with the period total */
export async function listPayments(db: DbOrTx, f: Partial<PaymentFilter> = {}) {
	const where: SQL[] = [];
	const q = f.q?.trim();
	if (q) {
		const like = `%${likeEscape(q)}%`;
		where.push(
			or(
				ilike(payment.receiptNumber, like),
				ilike(invoice.number, like),
				ilike(client.name, like),
				ilike(booking.title, like)
			)!
		);
	}
	if (f.method) where.push(eq(payment.method, f.method));
	if (f.month) where.push(sql`to_char(${payment.paidOn}, 'YYYY-MM') = ${f.month}`);
	const rows = await db
		.select({
			...paymentColumns,
			bookingId: booking.id,
			bookingTitle: booking.title,
			clientName: client.name
		})
		.from(payment)
		.innerJoin(booking, eq(booking.id, payment.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.leftJoin(invoice, eq(invoice.id, payment.invoiceId))
		.leftJoin(bookingInstallment, eq(bookingInstallment.id, payment.installmentId))
		.where(and(...where))
		.orderBy(desc(payment.paidOn), desc(payment.createdAt))
		.limit(500);
	return { rows, total: rows.reduce((s, r) => s + r.amount, 0) };
}

/**
 * What a booking can still be paid for, for the payment form: open invoices, the part of each
 * installment not on an invoice yet (paying it creates that invoice), and, while nothing is paid or
 * billed, "Lunas sekaligus" (the whole price at once), each with the amount still open.
 */
export async function paymentTargets(db: DbOrTx, bookingId: string) {
	const [installments, invoices] = await Promise.all([
		db
			.select({
				id: bookingInstallment.id,
				kind: bookingInstallment.kind,
				amount: bookingInstallment.amount,
				cancelledAt: bookingInstallment.cancelledAt,
				paid: sql<number>`(select coalesce(sum(p.amount), 0) from "payment" p where p.installment_id = "booking_installment"."id")::bigint`.mapWith(
					Number
				),
				unbilled: unbilledSql.mapWith(Number)
			})
			.from(bookingInstallment)
			.where(eq(bookingInstallment.bookingId, bookingId))
			.orderBy(asc(bookingInstallment.sort)),
		db
			.select({
				id: invoice.id,
				number: invoice.number,
				total: invoice.total,
				status: invoice.status,
				installmentId: invoice.installmentId,
				paid: sql<number>`(select coalesce(sum(p.amount), 0) from "payment" p where p.invoice_id = "invoice"."id")::bigint`.mapWith(
					Number
				)
			})
			.from(invoice)
			.where(and(eq(invoice.bookingId, bookingId), ne(invoice.status, 'void')))
			.orderBy(asc(invoice.issueDate), asc(invoice.number))
	]);
	const openInvoices = invoices.filter((i) => i.total - i.paid > 0);
	const withOpenInvoice = new Set(openInvoices.map((i) => i.installmentId).filter(Boolean));
	const kindOf = new Map(installments.map((i) => [i.id, i.kind]));

	// "Lunas sekaligus" while the DP can still be switched: no payment, no invoice on the schedule
	const dp = installments.find((i) => i.kind === 'dp' && !i.cancelledAt);
	const untouched =
		!installments.some((i) => i.paid > 0) &&
		!invoices.some((i) => i.installmentId && kindOf.has(i.installmentId));
	const scheduled = installments
		.filter((i) => i.kind !== 'other' && !i.cancelledAt)
		.reduce((s, i) => s + i.amount, 0);

	return [
		...openInvoices.map((i) => {
			const kind = i.installmentId ? kindOf.get(i.installmentId) : undefined;
			return {
				value: `inv:${i.id}`,
				// "DP 50% · INV/NM/…" so the termin stays recognisable once it has its invoice
				label: kind ? `${INSTALLMENT_LABEL[kind]} · ${i.number}` : i.number,
				open: i.total - i.paid
			};
		}),
		...installments
			.filter((i) => !i.cancelledAt && !withOpenInvoice.has(i.id) && i.unbilled > 0)
			.map((i) => ({
				value: `inst:${i.id}`,
				label: INSTALLMENT_LABEL[i.kind],
				open: i.unbilled
			})),
		...(dp && untouched && scheduled > dp.amount
			? [
					{
						value: `full:${dp.id}`,
						label: `${INSTALLMENT_LABEL.full} (DP + pelunasan)`,
						open: scheduled
					}
				]
			: [])
	];
}

export type PaymentTarget = Awaited<ReturnType<typeof paymentTargets>>[number];

/** Bookings the payment form can pick (not Batal), newest first */
export async function payableBookings(db: DbOrTx) {
	return db
		.select({ id: booking.id, title: booking.title, clientName: client.name })
		.from(booking)
		.innerJoin(client, eq(client.id, booking.clientId))
		.where(ne(booking.stage, 'lost'))
		.orderBy(desc(booking.createdAt))
		.limit(1000);
}

/** Paid per booking, for lists (client page) */
export async function paidByBooking(db: DbOrTx, bookingIds: string[]) {
	if (!bookingIds.length) return new Map<string, number>();
	const rows = await db
		.select({ bookingId: payment.bookingId, paid: sumAmount })
		.from(payment)
		.where(inArray(payment.bookingId, bookingIds))
		.groupBy(payment.bookingId);
	return new Map(rows.map((r) => [r.bookingId, r.paid]));
}

/** Kwitansi data: the payment, who paid, what for, and the booking's balance after it */
export async function getPaymentForReceipt(db: DbOrTx, id: string) {
	const [row] = await db
		.select({
			id: payment.id,
			receiptNumber: payment.receiptNumber,
			paidOn: payment.paidOn,
			amount: payment.amount,
			method: payment.method,
			note: payment.note,
			invoiceNumber: invoice.number,
			invoiceItems: invoice.items,
			installmentKind: bookingInstallment.kind,
			booking: { id: booking.id, title: booking.title, agreedPrice: booking.agreedPrice },
			client: { name: client.name, phone: client.phone, city: client.city }
		})
		.from(payment)
		.innerJoin(booking, eq(booking.id, payment.bookingId))
		.innerJoin(client, eq(client.id, booking.clientId))
		.leftJoin(invoice, eq(invoice.id, payment.invoiceId))
		.leftJoin(bookingInstallment, eq(bookingInstallment.id, payment.installmentId))
		.where(eq(payment.id, id));
	if (!row) return null;
	// Paid on the booking up to and including this receipt (receipt numbers order the same day)
	const [{ paidSoFar }] = await db
		.select({
			paidSoFar: sql<number>`coalesce(sum(${payment.amount}), 0)::bigint`.mapWith(Number)
		})
		.from(payment)
		.where(
			and(
				eq(payment.bookingId, row.booking.id),
				// compared in SQL: created_at has microseconds, a JS Date only milliseconds
				sql`(${payment.paidOn}, ${payment.createdAt}) <= (select p.paid_on, p.created_at from "payment" p where p.id = ${id})`
			)
		);
	// "Rincian": the paid invoice's lines, else the booking's package + add-ons
	const items = row.invoiceItems ?? (await bookingContractLines(db, row.booking.id));
	return { ...row, items, paidSoFar };
}

export type ReceiptDetail = NonNullable<Awaited<ReturnType<typeof getPaymentForReceipt>>>;
