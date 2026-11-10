// Form schemas for the CRM (P2-02 onwards). Messages are UI copy (Bahasa Indonesia).
import { z } from 'zod';
import { phoneNormalize } from '../format.ts';

/** Empty string → null, otherwise trimmed */
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.default('')
		.transform((v) => v || null);

export const clientSchema = z.object({
	name: z.string().trim().min(1, 'Nama wajib diisi.').max(120),
	phone: z
		.string()
		.trim()
		.max(30)
		.default('')
		.transform((v, ctx) => {
			if (!v) return null;
			const n = phoneNormalize(v);
			if (!n) {
				ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp tidak valid.' });
				return z.NEVER;
			}
			return n;
		}),
	email: z
		.string()
		.trim()
		.toLowerCase()
		.max(200)
		.default('')
		.refine((v) => v === '' || z.email().safeParse(v).success, 'Email tidak valid.')
		.transform((v) => v || null),
	instagram: z
		.string()
		.trim()
		.max(60)
		.default('')
		// Accept "@handle", "handle" or a profile URL; store the bare handle
		.transform((v) =>
			v
				.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
				.replace(/^@/, '')
				.replace(/[/?#].*$/, '')
		)
		.refine((v) => v === '' || /^[A-Za-z0-9._]{1,30}$/.test(v), 'Username Instagram tidak valid.')
		.transform((v) => v || null),
	city: optionalText(80),
	sourceId: z
		.string()
		.default('')
		.refine((v) => v === '' || z.uuid().safeParse(v).success, 'Sumber tidak valid.')
		.transform((v) => v || null),
	notes: optionalText(2000)
});

export type ClientInput = z.output<typeof clientSchema>;

export const clientIdSchema = z.object({ id: z.uuid() });

export const clientArchiveSchema = z.object({
	id: z.uuid(),
	archived: z.enum(['true', 'false']).transform((v) => v === 'true')
});

/** List filters from the URL: ?q=…&sumber=…&arsip=1 */
export const clientFilterSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	sourceId: z.uuid().nullable().catch(null),
	archived: z.boolean().catch(false)
});

// ---------- Bookings (P2-03) ----------

const EVENT_TYPE_KEYS = [
	'wedding',
	'akad',
	'resepsi',
	'lamaran',
	'engagement',
	'prewedding',
	'other'
] as const;
const STAGE_KEYS = [
	'inquiry',
	'consultation',
	'quotation',
	'booked',
	'preparation',
	'event_day',
	'editing',
	'completed',
	'lost'
] as const;
/** A new booking can only start before Booked: Booked needs a paid DP */
const OPEN_STAGE_KEYS = ['inquiry', 'consultation', 'quotation'] as const;

const time = z
	.string()
	.trim()
	.default('')
	.refine((v) => v === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Jam tidak valid (JJ:MM).')
	.transform((v) => v || null);

const isoDate = z
	.string()
	.trim()
	.default('')
	.refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Tanggal tidak valid.')
	.transform((v) => v || null);

export const sessionInputSchema = z
	.object({
		eventType: z.enum(EVENT_TYPE_KEYS, 'Pilih jenis sesi.'),
		date: isoDate,
		startTime: time,
		endTime: time,
		venue: optionalText(200),
		city: optionalText(80),
		notes: optionalText(500)
	})
	.refine((s) => !s.startTime || !s.endTime || s.startTime < s.endTime, {
		message: 'Jam selesai harus setelah jam mulai.',
		path: ['endTime']
	});

export const addonLineSchema = z.object({
	addonId: z.uuid().nullable().default(null),
	name: z.string().trim().min(1, 'Nama add-on wajib diisi.').max(120),
	unitPrice: z.number().int().min(0).max(10_000_000_000),
	qty: z.number().int().min(1, 'Jumlah minimal 1.').max(99)
});

/** JSON posted in a hidden field (sessions / add-on rows) */
const jsonArray = <T extends z.ZodType>(item: T) =>
	z
		.string()
		.default('[]')
		.transform((v, ctx) => {
			try {
				return JSON.parse(v) as unknown;
			} catch {
				ctx.addIssue({ code: 'custom', message: 'Data tidak valid.' });
				return z.NEVER;
			}
		})
		.pipe(z.array(item));

export const bookingSchema = z
	.object({
		clientId: z
			.string()
			.default('')
			.transform((v) => v || null)
			.pipe(z.uuid().nullable()),
		/** Inline new client (used when clientId is empty) */
		newClientName: optionalText(120),
		newClientPhone: z
			.string()
			.trim()
			.max(30)
			.default('')
			.transform((v, ctx) => {
				if (!v) return null;
				const n = phoneNormalize(v);
				if (!n) {
					ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp tidak valid.' });
					return z.NEVER;
				}
				return n;
			}),
		title: z.string().trim().min(1, 'Judul wajib diisi.').max(160),
		eventType: z.enum(EVENT_TYPE_KEYS, 'Pilih jenis acara.'),
		stage: z.enum(OPEN_STAGE_KEYS).default('inquiry'),
		packageId: z
			.string()
			.default('')
			.transform((v) => v || null)
			.pipe(z.uuid().nullable()),
		agreedPrice: z.coerce
			.number('Harga tidak valid.')
			.int('Harga tidak valid.')
			.min(0, 'Harga tidak boleh negatif.')
			.max(10_000_000_000),
		notes: optionalText(4000),
		sessions: jsonArray(sessionInputSchema).refine(
			(s) => s.length >= 1,
			'Tambahkan minimal satu sesi.'
		),
		addons: jsonArray(addonLineSchema),
		/** 0–2 crew (services/crew.ts MAX_CREW_PER_BOOKING) */
		crewIds: jsonArray(z.uuid()).refine((ids) => ids.length <= 2, 'Maksimal 2 kru per booking.')
	})
	.superRefine((v, ctx) => {
		if (!v.clientId && !v.newClientName)
			ctx.addIssue({
				code: 'custom',
				path: ['clientId'],
				message: 'Pilih klien atau isi klien baru.'
			});
	});

export type BookingInput = z.output<typeof bookingSchema>;
export type SessionInput = z.output<typeof sessionInputSchema>;

export const bookingMoveSchema = z.object({
	id: z.uuid(),
	to: z.enum(STAGE_KEYS),
	beforeId: z
		.string()
		.default('')
		.transform((v) => v || null)
		.pipe(z.uuid().nullable()),
	afterId: z
		.string()
		.default('')
		.transform((v) => v || null)
		.pipe(z.uuid().nullable()),
	lostReason: optionalText(500),
	/** Selesai with an outstanding balance: the person confirmed the warning */
	confirmBalance: z
		.string()
		.default('')
		.transform((v) => v === 'yes')
});

export type BookingMoveInput = z.output<typeof bookingMoveSchema>;

/** List filters from the URL: ?q=…&tahap=…&jenis=…&bulan=yyyy-MM */
export const bookingFilterSchema = z.object({
	q: z.string().trim().max(100).catch(''),
	stage: z.enum(STAGE_KEYS).nullable().catch(null),
	eventType: z.enum(EVENT_TYPE_KEYS).nullable().catch(null),
	month: z
		.string()
		.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
		.nullable()
		.catch(null)
});

export type BookingFilter = z.output<typeof bookingFilterSchema>;

/** Activities a person writes on the booking page (the rest come from services) */
export const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'whatsapp', 'meeting'] as const;

export const activitySchema = z.object({
	bookingId: z.uuid(),
	type: z.enum(MANUAL_ACTIVITY_TYPES, 'Pilih jenis aktivitas.'),
	body: z.string().trim().min(1, 'Tulis isi catatan.').max(2000, 'Maksimal 2.000 karakter.')
});

export type ActivityInput = z.output<typeof activitySchema>;

/** Pengiriman card: Google Drive (or any) link and the raw / edited delivery dates */
export const deliverySchema = z.object({
	id: z.uuid(),
	deliveryLink: z
		.string()
		.trim()
		.max(500)
		.default('')
		.refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Link harus diawali https://')
		.transform((v) => v || null),
	rawDeliveredOn: isoDate,
	editedDeliveredOn: isoDate
});

export type DeliveryInput = z.output<typeof deliverySchema>;

/** Optional WhatsApp, stored as 628… */
const optionalPhone = z
	.string()
	.trim()
	.max(30)
	.default('')
	.transform((v, ctx) => {
		if (!v) return null;
		const n = phoneNormalize(v);
		if (!n) {
			ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp tidak valid.' });
			return z.NEVER;
		}
		return n;
	});

/** Kru: an asset (no login), assigned to bookings */
export const crewSchema = z.object({
	id: z
		.string()
		.default('')
		.transform((v) => v || null)
		.pipe(z.uuid().nullable()),
	name: z.string().trim().min(1, 'Nama wajib diisi.').max(120),
	role: z.string().trim().max(60).default(''),
	phone: optionalPhone,
	// Checkbox: present = on
	active: z
		.string()
		.optional()
		.transform((v) => v === 'on' || v === 'true')
});

export type CrewFormInput = z.output<typeof crewSchema>;
