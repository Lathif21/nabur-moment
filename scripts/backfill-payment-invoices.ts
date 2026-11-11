// One-off backfill (11 Nov 2026, rule "every payment has an invoice"): payments recorded against a
// DP / Pelunasan before that rule have no invoice. For each such installment this creates the
// invoice it would have got (dated the first payment, contract lines, numbered in that month),
// links the payments to it and syncs its status (paid / partial).
//   - installment without an active invoice: total = what the installment bills, as recordPayment
//     does now (only the money received when the installment or the booking is cancelled);
//   - installment that got an invoice later for the rest: a separate invoice for the money that
//     came in before it (total = those payments, so it is paid).
// Dry run by default; `--apply` writes. Safe to re-run: linked payments are skipped.
//   npm run payments:backfill-invoices                          (DATABASE_URL from .env = dev)
//   npm run payments:backfill-invoices -- --url "<conn>" --apply
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { createDb } from '../src/lib/server/db/client.ts';
import {
	booking,
	bookingInstallment,
	invoice,
	payment
} from '../src/lib/server/db/schema/index.ts';
import { INSTALLMENT_LABEL, suggestedDueDate } from '../src/lib/finance.ts';
import { rupiah } from '../src/lib/format.ts';
import { insertInstallmentInvoice } from '../src/lib/server/services/invoices.ts';
import { syncInvoiceStatus } from '../src/lib/server/services/payments.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const i = process.argv.indexOf('--url');
const url = i > 0 ? process.argv[i + 1] : process.env.DATABASE_URL;
const apply = process.argv.includes('--apply');
if (!url) {
	console.error('No DATABASE_URL: pass --url "<connection string>"');
	process.exit(1);
}

const db = createDb(url);
try {
	const orphans = await db
		.select({ receipt: payment.receiptNumber })
		.from(payment)
		.where(and(isNull(payment.invoiceId), isNull(payment.installmentId)));
	if (orphans.length)
		console.warn(
			`Tanpa invoice dan tanpa termin (dilewati, periksa manual): ${orphans.map((o) => o.receipt).join(', ')}`
		);

	const groups = await db
		.select({ installmentId: payment.installmentId })
		.from(payment)
		.where(and(isNull(payment.invoiceId), isNotNull(payment.installmentId)))
		.groupBy(payment.installmentId);
	if (!groups.length) console.log('Semua pembayaran sudah punya invoice. Tidak ada yang diubah.');

	for (const { installmentId } of groups) {
		await db.transaction(async (tx) => {
			const [inst] = await tx
				.select()
				.from(bookingInstallment)
				.where(eq(bookingInstallment.id, installmentId!))
				.for('update');
			const [b] = await tx
				.select({ title: booking.title, stage: booking.stage })
				.from(booking)
				.where(eq(booking.id, inst.bookingId));
			const pays = await tx
				.select()
				.from(payment)
				.where(and(eq(payment.installmentId, inst.id), isNull(payment.invoiceId)))
				.orderBy(asc(payment.paidOn), asc(payment.receiptNumber));
			if (!pays.length) return;
			const received = pays.reduce((s, p) => s + p.amount, 0);
			const [active] = await tx
				.select({ number: invoice.number })
				.from(invoice)
				.where(and(eq(invoice.installmentId, inst.id), ne(invoice.status, 'void')))
				.limit(1);
			const [{ linked }] = await tx
				.select({
					linked: sql<number>`coalesce(sum(${payment.amount}), 0)::bigint`.mapWith(Number)
				})
				.from(payment)
				.where(and(eq(payment.installmentId, inst.id), isNotNull(payment.invoiceId)));
			const closed = !!active || !!inst.cancelledAt || b.stage === 'lost';
			const total = closed ? received : Math.max(received, inst.amount - linked);
			const issueDate = pays[0].paidOn;
			const receipts = pays.map((p) => p.receiptNumber).join(', ');
			const what = `${b.title} · ${INSTALLMENT_LABEL[inst.kind]}: ${receipts} (${rupiah(received)})`;

			if (!apply) {
				console.log(
					`[dry run] ${what} → invoice baru ${rupiah(total)} tgl ${issueDate}${active ? ` (termin sudah punya ${active.number})` : ''}`
				);
				return;
			}
			const inv = await insertInstallmentInvoice(tx, {
				bookingId: inst.bookingId,
				installment: inst,
				total,
				issueDate,
				dueDate: suggestedDueDate(inst.kind, inst.dueDate, issueDate),
				notes: null,
				userId: null
			});
			await tx
				.update(payment)
				.set({ invoiceId: inv.id })
				.where(
					inArray(
						payment.id,
						pays.map((p) => p.id)
					)
				);
			const status = await syncInvoiceStatus(tx, inv.id);
			console.log(`${what} → ${inv.number} ${rupiah(total)} (${status})`);
		});
	}
	if (!apply && groups.length)
		console.log('\nDry run: tidak ada yang ditulis. Jalankan dengan --apply.');
} finally {
	await db.$client.end();
}
