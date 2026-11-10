// Forms of the CMS lists (Paket, Add-on, Testimoni, FAQ). Messages are UI copy.
import { z } from 'zod';

const bool = z
	.union([z.literal('on'), z.literal('true'), z.literal('false'), z.literal('')])
	.optional()
	.transform((v) => v === 'on' || v === 'true');

const money = z.coerce
	.number({ error: 'Harga wajib diisi.' })
	.int('Harga harus angka bulat.')
	.min(0, 'Harga tidak boleh minus.')
	.max(10_000_000_000, 'Harga terlalu besar.');

const optionalId = z
	.union([z.uuid(), z.literal('')])
	.optional()
	.transform((v) => v || null);

export const categorySchema = z.object({
	id: optionalId,
	name: z.string().trim().min(1, 'Nama kategori wajib diisi.').max(60)
});

export const packageSchema = z
	.object({
		id: optionalId,
		categoryId: z.uuid('Pilih kategori.'),
		name: z.string().trim().min(1, 'Nama paket wajib diisi.').max(80),
		price: money,
		/** "Harga normal" (struck through on the site); empty = no promo */
		normalPrice: z
			.union([z.literal(''), money])
			.optional()
			.transform((v) => (v === '' || v === undefined ? null : v)),
		/** One inclusion per line */
		inclusions: z
			.string()
			.max(3000)
			.default('')
			.transform((v) =>
				v
					.split('\n')
					.map((l) => l.replace(/^[-•*]\s*/, '').trim())
					.filter(Boolean)
			),
		note: z.string().trim().max(300).default(''),
		imageMediaId: optionalId,
		featured: bool,
		visible: bool
	})
	.refine((d) => d.normalPrice === null || d.normalPrice > d.price, {
		message: 'Harga normal harus lebih tinggi dari harga paket, atau kosongkan.',
		path: ['normalPrice']
	});

export const addonSchema = z.object({
	id: optionalId,
	name: z.string().trim().min(1, 'Nama add-on wajib diisi.').max(80),
	price: money,
	description: z.string().trim().max(300).default(''),
	showOnSite: bool,
	active: bool
});

export const testimonialSchema = z.object({
	id: optionalId,
	name: z.string().trim().min(1, 'Nama wajib diisi.').max(80),
	quote: z.string().trim().min(1, 'Isi testimoni wajib diisi.').max(1000),
	eventLabel: z.string().trim().max(80).default(''),
	photoMediaId: optionalId,
	visible: bool
});

export const faqSchema = z.object({
	id: optionalId,
	question: z.string().trim().min(1, 'Pertanyaan wajib diisi.').max(200),
	answer: z.string().trim().min(1, 'Jawaban wajib diisi.').max(3000),
	visible: bool
});

/** Reorder: the full new order of one group */
export const reorderSchema = z.object({
	ids: z
		.string()
		.transform((v) => v.split(',').filter(Boolean))
		.pipe(z.array(z.uuid()).max(200))
});
