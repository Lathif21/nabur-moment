// Form schemas for Keuangan (Phase 3). Messages are UI copy (Bahasa Indonesia).
import { z } from 'zod';
import { INVOICE_STATUSES } from '../finance.ts';

const day = (label: string) =>
	z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/, `Isi ${label}.`);

const notes = z
	.string()
	.trim()
	.max(1000)
	.default('')
	.transform((v) => v || null);

/** Due date on or after the issue date */
const datesInOrder = (v: { issueDate: string; dueDate: string }) => v.dueDate >= v.issueDate;
const datesMessage = {
	message: 'Jatuh tempo tidak boleh sebelum tanggal invoice.',
	path: ['dueDate']
};

/** "Buat invoice" for a DP / Pelunasan installment */
export const installmentInvoiceSchema = z
	.object({
		installmentId: z.uuid('Pilih termin.'),
		issueDate: day('tanggal invoice'),
		dueDate: day('jatuh tempo'),
		notes
	})
	.refine(datesInOrder, datesMessage);

export type InstallmentInvoiceInput = z.output<typeof installmentInvoiceSchema>;

export const invoiceItemSchema = z.object({
	description: z.string().trim().min(1, 'Isi keterangan.').max(200),
	qty: z.coerce.number().int().min(1, 'Minimal 1.').max(999),
	unitPrice: z.coerce
		.number()
		.int('Harga harus angka bulat.')
		.min(0, 'Harga tidak boleh minus.')
		.max(10_000_000_000)
});

/** Custom invoice: free lines (add-ons, extra hours…); no discount lines, so nothing negative */
export const customInvoiceSchema = z
	.object({
		bookingId: z.uuid(),
		issueDate: day('tanggal invoice'),
		dueDate: day('jatuh tempo'),
		items: z
			.string()
			.default('[]')
			.transform((v, ctx) => {
				try {
					return JSON.parse(v) as unknown;
				} catch {
					ctx.addIssue({ code: 'custom', message: 'Data tidak valid.' });
					return z.NEVER;
				}
			})
			.pipe(z.array(invoiceItemSchema).min(1, 'Tambahkan minimal satu baris.').max(30)),
		notes
	})
	.refine(datesInOrder, datesMessage)
	.refine((v) => v.items.some((i) => i.qty * i.unitPrice > 0), {
		message: 'Total invoice harus lebih dari Rp 0.',
		path: ['items']
	});

export type CustomInvoiceInput = z.output<typeof customInvoiceSchema>;

export const invoiceIdSchema = z.object({ id: z.uuid() });

/** List filters from the URL: ?q=…&status=…&bulan=yyyy-MM (issue month) */
export const invoiceFilterSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	status: z.enum(INVOICE_STATUSES).nullable().catch(null),
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.nullable()
		.catch(null)
});

export type InvoiceFilter = z.output<typeof invoiceFilterSchema>;
