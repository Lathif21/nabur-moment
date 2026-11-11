// CRM labels and links shared by the admin screens (client-safe: no server imports).
// Stage and event-type order follow docs/02-DATA-MODEL.md.

export const STAGES = [
	{ key: 'inquiry', label: 'Inquiry' },
	{ key: 'consultation', label: 'Konsultasi' },
	{ key: 'quotation', label: 'Penawaran' },
	{ key: 'booked', label: 'Booked' },
	{ key: 'preparation', label: 'Persiapan' },
	{ key: 'event_day', label: 'Hari H' },
	{ key: 'editing', label: 'Editing' },
	{ key: 'completed', label: 'Selesai' },
	{ key: 'lost', label: 'Batal' }
] as const;

export type Stage = (typeof STAGES)[number]['key'];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
	STAGES.map((s) => [s.key, s.label])
) as Record<Stage, string>;

/** Stages that need the DP paid (`booked_at`) */
export const BOOKED_STAGES: readonly Stage[] = [
	'booked',
	'preparation',
	'event_day',
	'editing',
	'completed'
];

/** Chip tone for a stage: Batal red, Booked onwards green, the open stages neutral */
export const stageTone = (stage: Stage) =>
	stage === 'lost' ? 'chip--danger' : BOOKED_STAGES.includes(stage) ? 'chip--success' : '';

export const EVENT_TYPES = [
	{ key: 'wedding', label: 'Wedding' },
	{ key: 'akad', label: 'Akad' },
	{ key: 'resepsi', label: 'Resepsi' },
	{ key: 'lamaran', label: 'Lamaran' },
	{ key: 'engagement', label: 'Engagement' },
	{ key: 'prewedding', label: 'Prewedding' },
	{ key: 'other', label: 'Lainnya' }
] as const;

export type EventType = (typeof EVENT_TYPES)[number]['key'];

export const EVENT_TYPE_LABEL: Record<EventType, string> = Object.fromEntries(
	EVENT_TYPES.map((e) => [e.key, e.label])
) as Record<EventType, string>;

/** Admin wording (client feedback 12 Nov 2026): "Full Wedding"; the website keeps "Wedding" */
export const ADMIN_EVENT_LABEL: Record<EventType, string> = {
	...EVENT_TYPE_LABEL,
	wedding: 'Full Wedding'
};

/**
 * Booking and session types offered in the admin: no Lamaran (the website form and portfolio
 * still have it, so a booking may still carry it; `bookingEventTypes` then keeps it selectable).
 */
export const BOOKING_EVENT_TYPES = EVENT_TYPES.filter((e) => e.key !== 'lamaran').map((e) => ({
	key: e.key,
	label: ADMIN_EVENT_LABEL[e.key]
}));

/** Admin options for a booking / session select, keeping a no-longer-offered current value */
export function bookingEventTypes(current?: string | null) {
	if (!current || BOOKING_EVENT_TYPES.some((e) => e.key === current)) return BOOKING_EVENT_TYPES;
	const kept = EVENT_TYPES.find((e) => e.key === current);
	return kept
		? [...BOOKING_EVENT_TYPES, { key: kept.key, label: ADMIN_EVENT_LABEL[kept.key] }]
		: BOOKING_EVENT_TYPES;
}

export const ACTIVITY_LABEL: Record<string, string> = {
	note: 'Catatan',
	call: 'Telepon',
	whatsapp: 'WhatsApp',
	meeting: 'Pertemuan',
	stage_change: 'Pindah tahap',
	payment: 'Pembayaran',
	invoice: 'Invoice',
	expense: 'Pengeluaran',
	system: 'Sistem'
};

/** Stored `628…` → WhatsApp chat link */
export const waLink = (phone: string) => `https://wa.me/${phone}`;

/** Stored handle (no `@`) → profile link */
export const igLink = (handle: string) => `https://instagram.com/${encodeURIComponent(handle)}`;

/**
 * Kru search: every word of `q` is in the name, role, city or device, or `q` is part of the WhatsApp number
 * (typed as 0812…, 62812… or +62 812…; at least 3 digits).
 */
export function crewMatches(
	c: { name: string; role: string; phone: string | null; city?: string; device?: string },
	q: string
) {
	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const text = `${c.name} ${c.role} ${c.city ?? ''} ${c.device ?? ''}`.toLowerCase();
	if (words.every((w) => text.includes(w))) return true;
	const digits = q.replace(/\D/g, '');
	if (!c.phone || digits.length < 3 || /[a-z]/i.test(q)) return false;
	return c.phone.slice(2).includes(digits.replace(/^(62|0)/, ''));
}

/**
 * Payment chip on a booking: "Lunas" once payments cover the agreed price, "DP lunas" once the
 * DP is paid (`booked_at`), otherwise "Belum DP". None for Batal bookings.
 */
export function paymentChip(b: {
	stage: Stage;
	bookedAt: unknown;
	agreedPrice: number;
	paid: number;
}): { label: string; tone: string } | null {
	if (b.stage === 'lost') return null;
	if (b.agreedPrice > 0 && b.paid >= b.agreedPrice)
		return { label: 'Lunas', tone: 'chip--success' };
	if (b.bookedAt) return { label: 'DP lunas', tone: 'chip--success' };
	return { label: 'Belum DP', tone: 'chip--warning' };
}
