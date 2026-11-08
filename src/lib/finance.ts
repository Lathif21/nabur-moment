// Money rules shared by the services and the admin screens (client-safe, relative imports only).

/** The DP is always this share of the agreed price (Q3: fixed, not editable per booking) */
export const DP_PERCENT = 50;

/** DP (rounded down to whole Rupiah) and pelunasan (the rest, absorbs the odd rupiah) */
export function splitPrice(agreedPrice: number): { dp: number; pelunasan: number } {
	const dp = Math.floor((agreedPrice * DP_PERCENT) / 100);
	return { dp, pelunasan: agreedPrice - dp };
}

export const INSTALLMENT_LABEL: Record<'dp' | 'pelunasan' | 'other', string> = {
	dp: `DP ${DP_PERCENT}%`,
	pelunasan: 'Pelunasan',
	other: 'Lainnya'
};

export const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
	draft: 'Draf',
	sent: 'Terkirim',
	partial: 'Dibayar sebagian',
	paid: 'Lunas',
	overdue: 'Terlambat',
	void: 'Dibatalkan'
};

/** Chip tone per status (06-DESIGN-SYSTEM: overdue = danger) */
export const invoiceTone = (s: InvoiceStatus) =>
	s === 'paid'
		? 'chip--success'
		: s === 'overdue'
			? 'chip--danger'
			: s === 'partial' || s === 'sent'
				? 'chip--warning'
				: '';

/** Statuses that still expect money (and turn overdue after the due date) */
export const UNPAID_STATUSES: readonly InvoiceStatus[] = ['sent', 'partial', 'overdue'];

/**
 * `INV/NM/2026/11/007`, `KW/NM/2026/11/001`: month of the document date, 3-digit sequence (grows
 * past 999). `date` is `yyyy-MM-dd`.
 */
export function docNumber(kind: 'INV' | 'KW', date: string, seq: number): string {
	return `${kind}/NM/${date.slice(0, 4)}/${date.slice(5, 7)}/${String(seq).padStart(3, '0')}`;
}

/** Counter row key for the document's month: `INV-2026-11` */
export const counterKey = (kind: 'INV' | 'KW', date: string) => `${kind}-${date.slice(0, 7)}`;

/** Sum of invoice lines, whole Rupiah */
export const itemsTotal = (items: { qty: number; unitPrice: number }[]) =>
	items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

/** `yyyy-MM-dd` + n days (calendar arithmetic, no time zones) */
export function addDays(day: string, n: number): string {
	const [y, m, d] = day.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Days to pay the DP after the invoice date (a form default, editable) */
export const DP_INVOICE_DAYS = 7;

/**
 * Due date suggested in "Buat invoice": the DP within DP_INVOICE_DAYS, the pelunasan on Hari H
 * (never before the invoice date; DP_INVOICE_DAYS when Hari H is not set yet).
 */
export function suggestedDueDate(
	kind: 'dp' | 'pelunasan' | 'other',
	installmentDue: string | null,
	issueDate: string
): string {
	if (kind === 'pelunasan' && installmentDue)
		return installmentDue > issueDate ? installmentDue : issueDate;
	return addDays(issueDate, DP_INVOICE_DAYS);
}

export const PAYMENT_METHOD_LABEL: Record<'transfer' | 'cash' | 'ewallet' | 'other', string> = {
	transfer: 'Transfer bank',
	cash: 'Tunai',
	ewallet: 'E-wallet',
	other: 'Lainnya'
};
