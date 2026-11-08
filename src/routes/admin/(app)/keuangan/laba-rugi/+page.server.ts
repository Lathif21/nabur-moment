import { dayKeyWib } from '#lib/format.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { yearReport } from '#lib/server/services/reports.ts';
import type { PageServerLoad } from './$types';

// Laba Rugi (03-SCREENS B6, P3-07): one year, months × Pemasukan, Biaya langsung, Overhead,
// Laba bersih, and the year total (the same numbers as the Dashboard for Tahunan).
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'reports', 'read');
	const thisYear = Number(dayKeyWib().slice(0, 4));
	const asked = Number(url.searchParams.get('tahun'));
	const year = Number.isInteger(asked) && asked >= 2020 && asked <= thisYear + 1 ? asked : thisYear;
	return { year, thisYear, ...(await yearReport(db, year)) };
};
