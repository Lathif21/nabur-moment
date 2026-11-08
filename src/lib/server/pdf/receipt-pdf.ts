// Kwitansi PDF (P3-03): one receipt per payment, built from the saved payment and the business
// settings. Received from, amount in words, what for, the amount, the booking's balance after it.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { INSTALLMENT_LABEL, PAYMENT_METHOD_LABEL } from '../../finance.ts';
import { dateID, rupiah } from '../../format.ts';
import { terbilangRupiah } from '../../terbilang.ts';
import type { AppSettings } from '../services/app-settings.ts';
import type { ReceiptDetail } from '../services/payments.ts';
import { C, bandHeader, baseDocument, compact, label, render } from './common.ts';

const row = (name: string, value: Content): TableCell[] => [
	{ text: name, color: C.ink2, margin: [0, 5, 0, 5] },
	{ stack: [value], margin: [0, 5, 0, 5] } as TableCell
];

/** The document definition (pure, so it can be tested without rendering) */
export function receiptDocument(p: ReceiptDetail, s: AppSettings): TDocumentDefinitions {
	const purpose = [
		p.installmentKind ? INSTALLMENT_LABEL[p.installmentKind] : 'Tagihan tambahan',
		p.booking.title
	].join(' · ');
	const balance = Math.max(0, p.booking.agreedPrice - p.paidSoFar);

	const body: Content = {
		table: {
			widths: [120, '*'],
			body: [
				row('Telah terima dari', { text: p.client.name, bold: true }),
				row('Uang sejumlah', {
					table: {
						widths: ['*'],
						body: [
							[
								{
									text: terbilangRupiah(p.amount),
									italics: true,
									fillColor: C.sage20,
									margin: [8, 6, 8, 6]
								}
							]
						]
					},
					layout: 'noBorders'
				}),
				row('Untuk pembayaran', {
					stack: compact([
						{ text: purpose },
						p.invoiceNumber && { text: `Invoice ${p.invoiceNumber}`, color: C.ink2 },
						p.note && { text: p.note, color: C.ink2 }
					])
				}),
				row('Metode', { text: PAYMENT_METHOD_LABEL[p.method] }),
				row('Tanggal bayar', { text: dateID(p.paidOn, 'full') })
			]
		},
		layout: 'noBorders',
		margin: [0, 0, 0, 20]
	};

	const amountAndSign: Content = {
		columns: [
			{
				width: 220,
				stack: [
					{
						table: {
							widths: ['*'],
							body: [
								[
									{
										text: rupiah(p.amount),
										font: 'Playfair',
										fontSize: 20,
										bold: true,
										color: C.forest,
										fillColor: C.sage20,
										margin: [12, 10, 12, 10]
									}
								]
							]
						},
						layout: 'noBorders'
					},
					{
						text: [
							`Nilai booking ${rupiah(p.booking.agreedPrice)} · terbayar ${rupiah(p.paidSoFar)}`,
							`\nSisa ${rupiah(balance)}`
						],
						fontSize: 8,
						color: C.ink2,
						margin: [0, 6, 0, 0]
					}
				]
			},
			{ width: '*', text: '' },
			{
				width: 170,
				stack: [
					{ text: dateID(p.paidOn, 'full'), alignment: 'center' },
					{ text: 'Penerima,', alignment: 'center', color: C.ink2, margin: [0, 2, 0, 46] },
					{
						canvas: [
							{ type: 'line', x1: 10, y1: 0, x2: 160, y2: 0, lineWidth: 0.5, lineColor: C.line }
						]
					},
					{ text: s.businessName, alignment: 'center', bold: true, margin: [0, 4, 0, 0] }
				]
			}
		],
		unbreakable: true
	};

	return {
		...baseDocument(s, p.receiptNumber),
		content: [
			bandHeader('KWITANSI', p.receiptNumber),
			{ stack: [label('Bukti pembayaran')], margin: [0, 0, 0, 2] },
			body,
			amountAndSign
		]
	};
}

export function renderReceiptPdf(p: ReceiptDetail, s: AppSettings): Promise<Buffer> {
	return render(receiptDocument(p, s));
}
