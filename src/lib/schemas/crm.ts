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
