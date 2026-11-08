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
