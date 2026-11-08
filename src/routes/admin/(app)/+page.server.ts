import { error, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { dayKeyWib } from '#lib/format.ts';
import { can } from '#lib/permissions.ts';
import { firstAllowedHref } from '#lib/nav.ts';
import { resolvePeriod } from '#lib/period.ts';
import { db } from '#lib/server/db/index.ts';
import { FORBIDDEN_MESSAGE, requirePerm, requireUser } from '#lib/server/guards.ts';
import { refreshOverdue } from '#lib/server/services/invoices.ts';
import {
	invoicesNeedingAttention,
	moneySeries,
	newInquiries,
	periodTotals,
	pipelineCounts,
	receivables,
	upcomingSessions
} from '#lib/server/services/reports.ts';
import type { PageServerLoad } from './$types';

/** "vs periode sebelumnya" in %, or null when the previous period had nothing to compare with */
const delta = (now: number, prev: number) =>
	prev === 0 ? null : ((now - prev) / Math.abs(prev)) * 100;

// Dashboard (03-SCREENS B1, P3-06). /admin is where login lands; someone without Dashboard goes to
// their first allowed page. Money (KPI tiles, chart) needs Laba Rugi access (`reports`), the
// invoice panel `invoices`; upcoming events, pipeline and inquiries come with Dashboard.
export const load: PageServerLoad = async ({ locals, url }) => {
	requireUser(locals);
	const perms = [...(locals.perms ?? [])];
	if (!can(perms, 'dashboard')) {
		const href = firstAllowedHref(perms);
		if (!href) error(403, `${FORBIDDEN_MESSAGE} Minta pemilik memberi Anda peran.`);
		redirect(303, resolve(href));
	}
	requirePerm(locals, 'dashboard', 'read');

	const today = dayKeyWib();
	const p = url.searchParams;
	const period = resolvePeriod({ period: p.get('period'), from: p.get('from'), to: p.get('to') });
	const allow = {
		money: can(perms, 'reports', 'read'),
		invoices: can(perms, 'invoices', 'read'),
		bookings: can(perms, 'bookings', 'read')
	};

	if (allow.invoices) await refreshOverdue(db, today);
	// Piutang at the end of the period (today while the period is still running)
	const asOf = period.to < today ? period.to : today;

	const [money, upcoming, invoices, pipeline, inquiries] = await Promise.all([
		allow.money
			? Promise.all([
					periodTotals(db, period.from, period.to),
					periodTotals(db, period.prevFrom, period.prevTo),
					receivables(db, asOf),
					receivables(db, period.prevTo),
					moneySeries(db, period.seriesFrom, period.to, period.bucket)
				]).then(([now, prev, owed, prevOwed, series]) => ({
					now,
					owed,
					series,
					deltas: {
						income: delta(now.income, prev.income),
						expenses: delta(now.expenses, prev.expenses),
						profit: delta(now.profit, prev.profit),
						owed: delta(owed, prevOwed)
					}
				}))
			: null,
		upcomingSessions(db, today, 30),
		allow.invoices ? invoicesNeedingAttention(db, today) : [],
		pipelineCounts(db),
		newInquiries(db, 5)
	]);

	return { period, today, money, upcoming, invoices, pipeline, inquiries, allow };
};
