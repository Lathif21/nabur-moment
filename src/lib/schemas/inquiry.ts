// Public inquiry form (/booking, 03-SCREENS A6). Messages are UI copy.
import { z } from 'zod';
import { EVENT_TYPES } from '../crm.ts';
import { phoneNormalize } from '../format.ts';
import { clientSchema } from './crm.ts';

const optional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.default('')
		.transform((v) => v || null);

export const inquirySchema = z.object({
	name: clientSchema.shape.name,
	// Required here (the admin form allows an empty phone)
	phone: z
		.string()
		.trim()
		.min(1, 'No. WhatsApp wajib diisi.')
		.max(30)
		.transform((v, ctx) => {
			const n = phoneNormalize(v);
			if (!n || n.length < 10) {
				ctx.addIssue({ code: 'custom', message: 'Nomor WhatsApp tidak valid.' });
				return z.NEVER;
			}
			return n;
		}),
	email: clientSchema.shape.email,
	instagram: clientSchema.shape.instagram,
	eventType: z.enum(EVENT_TYPES.map((e) => e.key) as [string, ...string[]], {
		error: 'Pilih jenis acara.'
	}),
	eventDate: z
		.union([z.iso.date({ error: 'Tanggal tidak valid.' }), z.literal('')])
		.default('')
		.transform((v) => v || null),
	venue: optional(120),
	city: optional(80),
	/** A package id from /paket, or "belum" (not sure yet) */
	packageId: z
		.string()
		.default('')
		.transform((v) => (z.uuid().safeParse(v).success ? v : null)),
	sourceId: z
		.string()
		.default('')
		.transform((v) => (z.uuid().safeParse(v).success ? v : null)),
	message: optional(2000),
	/** Honeypot: hidden from people, filled by bots */
	website: z.string().default('')
});

export type InquiryInput = z.output<typeof inquirySchema>;
