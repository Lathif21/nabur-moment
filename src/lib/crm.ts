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
