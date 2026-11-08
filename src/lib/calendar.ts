// Month-grid arithmetic for the Kalender (P2-05). Client-safe and time-zone free: days are
// `yyyy-MM-dd` calendar dates, months `yyyy-MM`; "today" comes from dayKeyWib().

const MONTHS_ID = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember'
];

/** Column headers, Monday first */
export const WEEKDAYS_ID = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const pad = (n: number) => String(n).padStart(2, '0');
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function isMonth(value: string | null | undefined): value is string {
	return !!value && MONTH_RE.test(value);
}

function parts(month: string) {
	const m = MONTH_RE.exec(month);
	if (!m) throw new Error(`Expected yyyy-MM, got "${month}"`);
	return { y: Number(m[1]), m: Number(m[2]) };
}

/** `2026-11` + 1 → `2026-12`; crosses years */
export function shiftMonth(month: string, delta: number): string {
	const { y, m } = parts(month);
	const d = new Date(Date.UTC(y, m - 1 + delta, 1));
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** `2026-11` → `November 2026` */
export function monthLabel(month: string): string {
	const { y, m } = parts(month);
	return `${MONTHS_ID[m - 1]} ${y}`;
}

/**
 * Weeks of the month view, Monday first: full weeks from the Monday on or before the 1st to the
 * Sunday on or after the last day (4 to 6 rows).
 */
export function monthGrid(month: string): string[][] {
	const { y, m } = parts(month);
	const first = new Date(Date.UTC(y, m - 1, 1));
	const last = new Date(Date.UTC(y, m, 0));
	// getUTCDay: Sunday 0 … Saturday 6 → days back to Monday
	const start = new Date(first);
	start.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
	const end = new Date(last);
	end.setUTCDate(last.getUTCDate() + ((7 - last.getUTCDay()) % 7));

	const weeks: string[][] = [];
	for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
		if (weeks.length === 0 || weeks[weeks.length - 1].length === 7) weeks.push([]);
		weeks[weeks.length - 1].push(key(d));
	}
	return weeks;
}

/** First and last day the grid shows */
export function gridRange(month: string): { from: string; to: string } {
	const weeks = monthGrid(month);
	return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
}
