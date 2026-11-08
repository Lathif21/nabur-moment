// Amounts in Indonesian words for the invoice and kwitansi "Terbilang" line (P3-03).
// Client-safe, no dependencies. 1.250.000 → "satu juta dua ratus lima puluh ribu".

const ONES = [
	'',
	'satu',
	'dua',
	'tiga',
	'empat',
	'lima',
	'enam',
	'tujuh',
	'delapan',
	'sembilan',
	'sepuluh',
	'sebelas'
];

/** 0 … 999 */
function hundreds(n: number): string {
	if (n < 12) return ONES[n];
	if (n < 20) return `${ONES[n - 10]} belas`;
	if (n < 100) {
		const rest = n % 10;
		return `${ONES[Math.floor(n / 10)]} puluh${rest ? ` ${ONES[rest]}` : ''}`;
	}
	const rest = n % 100;
	const head = n < 200 ? 'seratus' : `${ONES[Math.floor(n / 100)]} ratus`;
	return rest ? `${head} ${hundreds(rest)}` : head;
}

const SCALES = ['', 'ribu', 'juta', 'miliar', 'triliun'];

/** Whole Rupiah in words, lower case ("nol" for 0). Throws above 999 triliun. */
export function terbilang(amount: number): string {
	if (!Number.isInteger(amount) || amount < 0) throw new Error(`terbilang: invalid ${amount}`);
	if (amount === 0) return 'nol';
	const groups: number[] = [];
	for (let n = amount; n > 0; n = Math.floor(n / 1000)) groups.push(n % 1000);
	if (groups.length > SCALES.length) throw new Error(`terbilang: ${amount} is too large`);
	const words: string[] = [];
	for (let i = groups.length - 1; i >= 0; i--) {
		const g = groups[i];
		if (!g) continue;
		// 1.000 is "seribu", not "satu ribu"
		words.push(i === 1 && g === 1 ? 'seribu' : `${hundreds(g)}${SCALES[i] ? ` ${SCALES[i]}` : ''}`);
	}
	return words.join(' ');
}

/** "Satu juta dua ratus lima puluh ribu rupiah" for the PDFs */
export function terbilangRupiah(amount: number): string {
	const w = `${terbilang(amount)} rupiah`;
	return w.charAt(0).toUpperCase() + w.slice(1);
}
