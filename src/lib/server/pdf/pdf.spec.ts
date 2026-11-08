// P3-03 "Done when": both PDFs render with logo, numbers, amounts in words and bank details.
// Pure document checks plus a real render (the files land in PDF_OUT when set, for a visual look).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../services/app-settings';
import type { InvoiceDetail } from '../services/invoices';
import type { ReceiptDetail } from '../services/payments';
import { pdfFileName } from './common';
import { invoiceDocument, renderInvoicePdf } from './invoice-pdf';
import { receiptDocument, renderReceiptPdf } from './receipt-pdf';

const settings: AppSettings = {
	businessName: 'Nabur Moment',
	address: 'Jl. Contoh No. 1, Bandung',
	phone: '6281234567890',
	email: 'halo@naburmoment.com',
	instagram: 'naburmoment',
	bankName: 'BCA',
	bankNumber: '1234567890',
	bankHolder: 'Nabur Moment',
	updatedAt: null
};

const inv: InvoiceDetail = {
	id: '00000000-0000-4000-8000-000000000001',
	number: 'INV/NM/2026/11/007',
	status: 'sent',
	issueDate: '2026-11-08',
	dueDate: '2026-11-15',
	items: [
		{ description: 'Paket Gold', qty: 1, unitPrice: 9_000_000 },
		{ description: 'Add-on: Drone', qty: 1, unitPrice: 1_000_000 }
	],
	total: 5_000_000,
	notes: 'Terima kasih.',
	sentAt: new Date('2026-11-08T03:00:00Z'),
	voidedAt: null,
	createdAt: new Date('2026-11-08T03:00:00Z'),
	paid: 0,
	installmentKind: 'dp',
	installmentAmount: 5_000_000,
	booking: { id: 'b', title: 'Wedding Nadia & Raka', agreedPrice: 10_000_000 },
	client: { id: 'c', name: 'Nadia Putri', phone: '6281111111111', email: null },
	payments: []
};

const receipt: ReceiptDetail = {
	id: '00000000-0000-4000-8000-000000000002',
	receiptNumber: 'KW/NM/2026/11/003',
	paidOn: '2026-11-09',
	amount: 5_000_000,
	method: 'transfer',
	note: null,
	invoiceNumber: 'INV/NM/2026/11/007',
	installmentKind: 'dp',
	booking: { id: 'b', title: 'Wedding Nadia & Raka', agreedPrice: 10_000_000 },
	client: { name: 'Nadia Putri', phone: '6281111111111', city: 'Bandung' },
	paidSoFar: 5_000_000
};

/** Every text string of a pdfmake document, flattened */
function texts(node: unknown): string[] {
	if (typeof node === 'string') return [node];
	if (Array.isArray(node)) return node.flatMap(texts);
	if (node && typeof node === 'object')
		return Object.entries(node).flatMap(([k, v]) =>
			k === 'text' || typeof v === 'object' ? texts(v) : []
		);
	return [];
}

describe('invoice PDF', () => {
	it('has the wordmark, number, contract lines, installment billed, words and BCA account', () => {
		const doc = invoiceDocument(inv, settings);
		const all = texts(doc.content).join('\n');
		expect(all).toContain('NABUR');
		expect(all).toContain('INV/NM/2026/11/007');
		expect(all).toContain('Paket Gold');
		expect(all).toContain('Ditagih: DP 50%');
		expect(all).toMatch(/Rp\s?5\.000\.000/);
		expect(all).toContain('Lima juta rupiah');
		expect(all).toContain('BCA 1234567890');
		expect(all).toContain('a.n. Nabur Moment');
		expect(doc.watermark).toBeUndefined();
		expect(invoiceDocument({ ...inv, status: 'draft' }, settings).watermark).toMatchObject({
			text: 'DRAF'
		});
	});

	it('warns inside the PDF when the bank account is not set', () => {
		const all = texts(
			invoiceDocument(inv, { ...settings, bankNumber: null, bankHolder: null }).content
		).join('\n');
		expect(all).toContain('Nomor rekening belum diisi');
	});

	it('renders a PDF file', async () => {
		const pdf = await renderInvoicePdf(inv, settings);
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, 'invoice.pdf'), pdf);
		expect(pdfFileName(inv.number)).toBe('INV-NM-2026-11-007.pdf');
	});
});

describe('kwitansi PDF', () => {
	it('has the wordmark, number, payer, amount in words, purpose and balance', () => {
		const all = texts(receiptDocument(receipt, settings).content).join('\n');
		expect(all).toContain('NABUR');
		expect(all).toContain('KW/NM/2026/11/003');
		expect(all).toContain('Nadia Putri');
		expect(all).toContain('Lima juta rupiah');
		expect(all).toContain('DP 50% · Wedding Nadia & Raka');
		expect(all).toContain('Invoice INV/NM/2026/11/007');
		expect(all).toMatch(/Sisa Rp\s?5\.000\.000/);
	});

	it('renders a PDF file', async () => {
		const pdf = await renderReceiptPdf(receipt, settings);
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		if (process.env.PDF_OUT) writeFileSync(join(process.env.PDF_OUT, 'kwitansi.pdf'), pdf);
	});
});
