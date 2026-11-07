// Media forms and the upload API body. Messages are UI copy (Bahasa Indonesia).
import { z } from 'zod';

export const uploadSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('image'),
		filename: z.string().trim().min(1).max(200),
		width: z.int().positive().max(20000),
		height: z.int().positive().max(20000),
		variants: z.array(z.int().positive()).min(1).max(5),
		alt: z.string().trim().max(300).optional()
	}),
	z.object({
		kind: z.literal('video'),
		filename: z.string().trim().min(1).max(200),
		mime: z.string(),
		width: z.int().positive().max(10000).optional(),
		height: z.int().positive().max(10000).optional(),
		durationS: z
			.int()
			.nonnegative()
			.max(24 * 3600)
			.optional()
	})
]);

export const embedSchema = z.object({
	url: z.string().trim().min(1, 'Tempel tautan Instagram, TikTok, atau YouTube.')
});

export const mediaUpdateSchema = z.object({
	id: z.uuid(),
	alt: z.string().trim().max(300).default(''),
	focalX: z.coerce.number().min(0).max(1),
	focalY: z.coerce.number().min(0).max(1)
});

export const mediaListQuery = z.object({
	kind: z.enum(['image', 'video', 'embed']).optional().catch(undefined),
	unused: z
		.enum(['1'])
		.optional()
		.catch(undefined)
		.transform((v) => v === '1')
});
