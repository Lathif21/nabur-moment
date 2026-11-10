// Invoice PDF (P3-03): built from the saved invoice and the business settings only. Forest band
// with the wordmark, items right-aligned, "Terbilang" line, BCA box on sage-20, contacts footer.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { INSTALLMENT_LABEL, INVOICE_STATUS_LABEL, itemsTotal } from '../../finance.ts';
import { dateID, phoneDisplay, rupiah } from '../../format.ts';
import { terbilangRupiah } from '../../terbilang.ts';
import { bankReady, type AppSettings, type PdfSigner } from '../services/app-settings.ts';
import type { InvoiceDetail } from '../services/invoices.ts';
import {
	C,
	bandHeader,
	baseDocument,
	compact,
	itemCell,
	label,
	render,
	signatureBlock,
	tableLayout
} from './common.ts';

const WATERMARK: Partial<Record<InvoiceDetail['status'], { text: string; color: string }>> = {
	draft: { text: 'DRAF', color: C.olive },
	void: { text: 'DIBATALKAN', color: C.danger },
	paid: { text: 'LUNAS', color: C.success }
};

const right = (text: string, extra: { bold?: boolean } = {}): TableCell => ({
	text,
	alignment: 'right',
	...extra
});

/** The document definition (pure, so it can be tested without rendering) */
export function invoiceDocument(
	inv: InvoiceDetail,
	s: AppSettings,
	signer?: PdfSigner
): TDocumentDefinitions {
	const contract = itemsTotal(inv.items);
	// Installment invoice: the lines are the contract and the total is the installment billed
	const installment = !!inv.installmentKind && contract !== inv.total;
	const outstanding = inv.status === 'void' ? 0 : Math.max(0, inv.total - inv.paid);

	const parties: Content = {
		columns: [
			{
				width: '*',
				stack: compact([
					label('Kepada'),
					{ text: inv.client.name, bold: true },
					inv.client.phone && { text: `WA ${phoneDisplay(inv.client.phone)}`, color: C.ink2 },
					inv.client.email && { text: inv.client.email, color: C.ink2 }
				])
			},
			{
				width: '*',
				stack: compact([
					label('Untuk'),
					{ text: inv.booking.title, bold: true },
					{
						text: inv.installmentKind ? INSTALLMENT_LABEL[inv.installmentKind] : 'Tagihan tambahan',
						color: C.ink2
					}
				])
			},
			{
				width: 150,
				table: {
					widths: ['auto', '*'],
					body: [
						[{ text: 'Tanggal', color: C.ink2 }, right(dateID(inv.issueDate, 'full'))],
						[
							{ text: 'Jatuh tempo', color: C.ink2 },
							right(dateID(inv.dueDate, 'full'), { bold: true })
						],
						[{ text: 'Status', color: C.ink2 }, right(INVOICE_STATUS_LABEL[inv.status])]
					]
				},
				layout: 'noBorders'
			}
		],
		columnGap: 16,
		margin: [0, 0, 0, 18]
	};

	const head = (t: string, align: 'left' | 'right' = 'left'): TableCell => ({
		text: t.toUpperCase(),
		fontSize: 7.5,
		bold: true,
		color: C.ink2,
		characterSpacing: 0.6,
		alignment: align
	});
	const totalRow = (text: string, amount: number, bold = false): TableCell[] => [
		{ text, colSpan: 3, alignment: 'right', bold, color: bold ? C.ink : C.ink2 },
		'',
		'',
		right(rupiah(amount), { bold })
	];
	const items: Content = {
		table: {
			headerRows: 1,
			widths: ['*', 36, 90, 90],
			body: [
				[
					head('Keterangan'),
					head('Jml', 'right'),
					head('Harga', 'right'),
					head('Subtotal', 'right')
				],
				...inv.items.map((it) => [
					itemCell(it),
					right(String(it.qty)),
					right(rupiah(it.unitPrice)),
					right(rupiah(it.qty * it.unitPrice))
				]),
				...(installment
					? [
							totalRow('Nilai kontrak', contract),
							totalRow(`Ditagih: ${INSTALLMENT_LABEL[inv.installmentKind!]}`, inv.total, true)
						]
					: [totalRow('Total', inv.total, true)]),
				...(inv.paid > 0
					? [totalRow('Sudah dibayar', inv.paid), totalRow('Sisa tagihan', outstanding, true)]
					: [])
			]
		},
		layout: tableLayout
	};

	const words: Content = {
		text: [
			{ text: 'Terbilang: ', color: C.ink2 },
			{ text: terbilangRupiah(inv.paid > 0 ? outstanding : inv.total), italics: true }
		],
		margin: [0, 10, 0, 16]
	};

	const bank: Content = {
		table: {
			widths: ['*'],
			body: [
				[
					{
						fillColor: C.sage20,
						margin: [10, 8, 10, 8],
						stack: bankReady(s)
							? [
									label('Pembayaran melalui transfer'),
									{ text: `${s.bankName} ${s.bankNumber}`, bold: true, fontSize: 12 },
									{ text: `a.n. ${s.bankHolder}` },
									{
										text: `Mohon cantumkan nomor ${inv.number} pada berita transfer.`,
										color: C.ink2,
										fontSize: 8.5,
										margin: [0, 4, 0, 0]
									}
								]
							: [
									label('Pembayaran melalui transfer'),
									{
										text: 'Nomor rekening belum diisi (Pengaturan → Bisnis & Keuangan).',
										color: C.danger
									}
								]
					}
				]
			]
		},
		layout: 'noBorders',
		unbreakable: true
	};

	const mark = WATERMARK[inv.status];
	return {
		...baseDocument(s, inv.number),
		content: compact([
			bandHeader('INVOICE', inv.number),
			parties,
			items,
			words,
			bank,
			inv.notes && { stack: [label('Catatan'), { text: inv.notes }], margin: [0, 16, 0, 0] },
			{
				columns: [
					{ width: '*', text: '' },
					signatureBlock(s, signer, 'Hormat kami,', dateID(inv.issueDate, 'full'))
				],
				margin: [0, 24, 0, 0],
				unbreakable: true
			}
		]),
		watermark: mark
			? { text: mark.text, color: mark.color, opacity: 0.08, bold: true, fontSize: 90 }
			: undefined
	};
}

export function renderInvoicePdf(
	inv: InvoiceDetail,
	s: AppSettings,
	signer?: PdfSigner
): Promise<Buffer> {
	return render(invoiceDocument(inv, s, signer));
}
