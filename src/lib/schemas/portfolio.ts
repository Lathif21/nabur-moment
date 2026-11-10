// Album form (Konten → Portofolio). Messages are UI copy.
import { z } from 'zod';
import { EVENT_TYPES } from '../crm.ts';

const bool = z
	.union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
	.optional()
	.transform((v) => v === 'on' || v === 'true');

export const albumSchema = z.object({
	id: z
		.union([z.uuid(), z.literal('')])
		.optional()
		.transform((v) => v || null),
	title: z.string().trim().min(1, 'Judul album wajib diisi.').max(80),
	slug: z
		.string()
		.trim()
		.max(60)
		.regex(/^[a-z0-9-]*$/, 'Hanya huruf kecil, angka, dan tanda minus.')
		.default(''),
	eventType: z.enum(EVENT_TYPES.map((e) => e.key) as [string, ...string[]], {
		error: 'Pilih jenis acara.'
	}),
	eventDate: z
		.union([z.iso.date(), z.literal('')])
		.optional()
		.transform((v) => v || null),
	venue: z.string().trim().max(120).default(''),
	city: z.string().trim().max(60).default(''),
	story: z.string().trim().max(2000).default(''),
	coverMediaId: z
		.union([z.uuid(), z.literal('')])
		.optional()
		.transform((v) => v || null),
	visible: bool,
	/** JSON: [{ mediaId, caption }] in order */
	items: z
		.string()
		.default('[]')
		.transform((v, ctx) => {
			try {
				return JSON.parse(v) as unknown;
			} catch {
				ctx.addIssue({ code: 'custom', message: 'Daftar media tidak valid.' });
				return z.NEVER;
			}
		})
		.pipe(
			z
				.array(
					z.object({
						mediaId: z.uuid(),
						caption: z.string().trim().max(200).default('')
					})
				)
				.max(200, 'Maksimal 200 media per album.')
		)
});
