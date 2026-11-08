import { gridRange, isMonth, monthGrid } from '#lib/calendar.ts';
import { EVENT_TYPES, type EventType } from '#lib/crm.ts';
import { dayKeyWib } from '#lib/format.ts';
import { can } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { listCalendar } from '#lib/server/services/calendar.ts';
import type { PageServerLoad } from './$types';

const EVENT_KEYS = new Set<string>(EVENT_TYPES.map((e) => e.key));

// Kalender (03-SCREENS B3): month grid of booking sessions, agenda on phones.
// ?bulan=yyyy-MM&jenis=<event type>&tentatif=0 (hide bookings without a paid DP)
export const load: PageServerLoad = async ({ locals, url }) => {
	requirePerm(locals, 'calendar', 'read');
	const p = url.searchParams;
	const today = dayKeyWib();
	const bulan = p.get('bulan');
	const month = isMonth(bulan) ? bulan : today.slice(0, 7);
	const jenis = p.get('jenis');
	const eventType = jenis && EVENT_KEYS.has(jenis) ? (jenis as EventType) : null;
	// The checkbox sends tentatif=1 next to a hidden tentatif=0; shown unless only the 0 arrives
	const t = p.getAll('tentatif');
	const includeTentative = t.length === 0 || t.includes('1');

	const { items, busyDays } = await listCalendar(db, {
		...gridRange(month),
		eventType,
		includeTentative
	});
	return {
		month,
		weeks: monthGrid(month),
		today,
		items,
		busyDays,
		filter: { eventType, includeTentative },
		allow: { bookings: can(locals.perms!, 'bookings', 'read') }
	};
};
