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

export const PAYMENT_METHODS = ['transfer', 'cash', 'ewallet', 'other'] as const;

/**
 * "Catat pembayaran": what it pays is an open invoice (`inv:<id>`) or an installment without one
 * (`inst:<id>`); the amount is capped at what is still open there.
 */
export const paymentSchema = z.object({
	bookingId: z.uuid('Pilih booking.'),
	target: z
		.string()
		.regex(/^(inv|inst):[0-9a-f-]{36}$/i, 'Pilih invoice atau termin yang dibayar.')
		.transform((v) => {
			const [kind, id] = v.split(':');
			return { kind: kind as 'inv' | 'inst', id };
		}),
	paidOn: day('tanggal bayar'),
	amount: z.coerce
		.number('Isi jumlah.')
		.int('Jumlah harus angka bulat.')
		.min(1, 'Jumlah harus lebih dari Rp 0.')
		.max(10_000_000_000),
	method: z.enum(PAYMENT_METHODS, 'Pilih metode.'),
	proofMediaId: z
		.string()
		.default('')
		.transform((v) => v || null)
		.pipe(z.uuid().nullable()),
	note: notes
});

export type PaymentInput = z.output<typeof paymentSchema>;

export const paymentIdSchema = z.object({ id: z.uuid() });

/** Payment list filters: ?q=…&metode=…&bulan=yyyy-MM (paid month) */
export const paymentFilterSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	method: z.enum(PAYMENT_METHODS).nullable().catch(null),
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.nullable()
		.catch(null)
});

export type PaymentFilter = z.output<typeof paymentFilterSchema>;

/** Proof upload step 1 (images only; the browser sends the file as-is to the private bucket) */
export const PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const proofUploadSchema = z.object({
	filename: z.string().trim().min(1).max(200),
	mime: z.enum(PROOF_MIME, 'Bukti harus berupa gambar JPG, PNG, atau WebP.'),
	bytes: z.number().int().min(1).max(PROOF_MAX_BYTES, 'Ukuran bukti maksimal 10 MB.')
});
