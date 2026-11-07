// Section registry (docs/04-ARCHITECTURE.md → CMS content flow): per page, its sections, their
// fields and default content. The Zod schema of each section is built from its fields, so the
// editor (generated from the same fields) and the server never disagree. Client-safe; relative
// imports only.
import { z } from 'zod';

/* ---------- Fields ---------- */

type Base = { key: string; label: string; hint?: string };

export type TextField = Base & { kind: 'text'; max?: number; placeholder?: string };
export type TextareaField = Base & { kind: 'textarea'; max?: number };
/** Limited rich text: bold, italic, links, paragraphs, line breaks (sanitised on save) */
export type RichTextField = Base & { kind: 'richtext'; max?: number };
/** One image (media id) */
export type ImageField = Base & { kind: 'image' };
/** One image or video (media id), e.g. the hero background */
export type MediaField = Base & { kind: 'media' };
/** Ordered image ids */
export type ImagesField = Base & { kind: 'images'; min?: number; max?: number };
export type LinkField = Base & { kind: 'link' };
export type SelectField = Base & { kind: 'select'; options: { value: string; label: string }[] };
export type NumberField = Base & { kind: 'number'; min: number; max: number };
export type ListField = Base & {
	kind: 'list';
	/** Label of one item, e.g. "Anggota tim" */
	itemLabel: string;
	fields: (TextField | TextareaField | ImageField)[];
	max?: number;
};

export type Field =
	| TextField
	| TextareaField
	| RichTextField
	| ImageField
	| MediaField
	| ImagesField
	| LinkField
	| SelectField
	| NumberField
	| ListField;

export type SectionDef = {
	key: string;
	label: string;
	description?: string;
	fields: Field[];
	defaults: Record<string, unknown>;
};

export type PageDef = {
	key: PageKey;
	label: string;
	/** Public path (no leading slash) */
	path: string;
	sections: SectionDef[];
};

/* ---------- Schemas from fields ---------- */

/** Internal path, https URL, WhatsApp / mailto / tel link */
const href = z
	.string()
	.trim()
	.max(500)
	.refine((v) => v === '' || /^(\/|https:\/\/|mailto:|tel:|#)/.test(v), {
		message: 'Tautan harus diawali /, https://, mailto: atau tel:'
	});

export const linkSchema = z.object({
	label: z.string().trim().max(60).default(''),
	href: href.default('')
});

function fieldSchema(f: Field): z.ZodType {
	switch (f.kind) {
		case 'text':
			return z
				.string()
				.trim()
				.max(f.max ?? 160)
				.default('');
		case 'textarea':
			return z
				.string()
				.trim()
				.max(f.max ?? 1000)
				.default('');
		case 'richtext':
			return z
				.string()
				.max(f.max ?? 6000)
				.default('');
		case 'image':
		case 'media':
			return z.uuid().nullable().default(null);
		case 'images':
			return z
				.array(z.uuid())
				.max(f.max ?? 24)
				.default([]);
		case 'link':
			return linkSchema.default({ label: '', href: '' });
		case 'select':
			return z
				.enum(f.options.map((o) => o.value) as [string, ...string[]])
				.default(f.options[0].value);
		case 'number':
			return z.coerce.number().int().min(f.min).max(f.max).default(f.min);
		case 'list':
			return z
				.array(z.object(Object.fromEntries(f.fields.map((x) => [x.key, fieldSchema(x)]))))
				.max(f.max ?? 12)
				.default([]);
	}
}

export function sectionSchema(def: SectionDef) {
	return z.object(Object.fromEntries(def.fields.map((f) => [f.key, fieldSchema(f)])));
}

/** Every media id a section's content refers to, with the field it sits in */
export function mediaRefs(def: SectionDef, data: Record<string, unknown>) {
	const refs: { field: string; mediaId: string }[] = [];
	const walk = (fields: Field[], value: Record<string, unknown>, prefix: string) => {
		for (const f of fields) {
			const v = value?.[f.key];
			const path = prefix + f.key;
			if ((f.kind === 'image' || f.kind === 'media') && typeof v === 'string')
				refs.push({ field: path, mediaId: v });
			if (f.kind === 'images' && Array.isArray(v))
				for (const id of v) if (typeof id === 'string') refs.push({ field: path, mediaId: id });
			if (f.kind === 'list' && Array.isArray(v))
				v.forEach((item, i) => walk(f.fields, item as Record<string, unknown>, `${path}.${i}.`));
		}
	};
	walk(def.fields, data, '');
	return refs;
}

/* ---------- Reused field sets ---------- */

const ctaFields: Field[] = [
	{ kind: 'image', key: 'image', label: 'Gambar latar' },
	{ kind: 'text', key: 'headline', label: 'Judul', max: 120 },
	{ kind: 'link', key: 'button', label: 'Tombol' }
];

const introFields: Field[] = [
	{ kind: 'text', key: 'eyebrow', label: 'Label kecil', max: 60 },
	{ kind: 'text', key: 'headline', label: 'Judul', max: 120 },
	{ kind: 'richtext', key: 'body', label: 'Paragraf' }
];

/* ---------- Pages ---------- */

export const PAGE_KEYS = ['home', 'about', 'packages', 'faq', 'portfolio', 'inquiry'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGES: PageDef[] = [
	{
		key: 'home',
		label: 'Beranda',
		path: '',
		sections: [
			{
				key: 'hero',
				label: 'Hero',
				description: 'Layar pertama: foto atau video latar dengan judul.',
				fields: [
					{
						kind: 'media',
						key: 'media',
						label: 'Foto atau video latar',
						hint: 'Video MP4 diputar tanpa suara dan berulang. Kosong = video contoh.'
					},
					{ kind: 'text', key: 'script', label: 'Teks tulisan tangan', max: 40 },
					{ kind: 'text', key: 'headline', label: 'Judul', max: 80 },
					{ kind: 'text', key: 'accent', label: 'Judul (miring)', max: 60 },
					{ kind: 'text', key: 'caption', label: 'Keterangan kecil', max: 80 },
					{
						kind: 'select',
						key: 'tone',
						label: 'Warna gambar',
						options: [
							{ value: 'mono', label: 'Hitam putih' },
							{ value: 'color', label: 'Berwarna' }
						]
					}
				],
				defaults: {
					media: null,
					script: 'Cerita kita',
					headline: 'Momen yang',
					accent: 'tak terulang',
					caption: 'Wedding content creator',
					tone: 'mono'
				}
			},
			{
				key: 'collage',
				label: 'Kolase foto',
				fields: [
					{ kind: 'images', key: 'images', label: 'Foto (6–9)', max: 9 },
					{ kind: 'text', key: 'headline', label: 'Judul', max: 120 },
					{ kind: 'link', key: 'button', label: 'Tombol' }
				],
				defaults: {
					images: [],
					headline: 'Setiap detail, diceritakan dengan hangat',
					button: { label: 'Lihat portofolio', href: '/portofolio' }
				}
			},
			{
				key: 'intro',
				label: 'Perkenalan',
				fields: [...introFields, { kind: 'image', key: 'image', label: 'Gambar' }],
				defaults: {
					eyebrow: 'Tentang kami',
					headline: 'Konten pernikahan yang terasa seperti kamu',
					body: '<p>Kami merekam momen candid di hari bahagiamu dan mengolahnya menjadi konten yang siap dibagikan.</p>',
					image: null
				}
			},
			{
				key: 'ticker',
				label: 'Pita kata',
				fields: [
					{
						kind: 'list',
						key: 'words',
						label: 'Kata',
						itemLabel: 'Kata',
						max: 10,
						fields: [{ kind: 'text', key: 'word', label: 'Kata', max: 30 }]
					}
				],
				defaults: { words: [{ word: 'Romantis' }, { word: 'Candid' }, { word: 'Estetik' }] }
			},
			{
				key: 'featured',
				label: 'Portofolio pilihan',
				description: 'Album diambil otomatis dari album bertanda "pilihan".',
				fields: [
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
					{ kind: 'number', key: 'count', label: 'Jumlah album', min: 2, max: 6 }
				],
				defaults: { heading: 'Cerita terbaru', count: 3 }
			},
			{
				key: 'packages',
				label: 'Paket',
				fields: [
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
					{ kind: 'textarea', key: 'body', label: 'Paragraf', max: 400 },
					{ kind: 'link', key: 'button', label: 'Tombol' }
				],
				defaults: {
					heading: 'Paket untuk setiap cerita',
					body: 'Dari lamaran sampai resepsi, pilih paket yang sesuai atau tambah add-on sesuai kebutuhan.',
					button: { label: 'Lihat paket', href: '/paket' }
				}
			},
			{
				key: 'testimonials',
				label: 'Testimoni',
				description: 'Isi testimoni diatur di Konten → Testimoni.',
				fields: [{ kind: 'text', key: 'heading', label: 'Judul', max: 120 }],
				defaults: { heading: 'Kata mereka' }
			},
			{
				key: 'cta',
				label: 'Ajakan booking',
				fields: ctaFields,
				defaults: {
					image: null,
					headline: 'Ceritakan hari bahagiamu',
					button: { label: 'Booking sekarang', href: '/booking' }
				}
			},
			{
				key: 'follow',
				label: 'Instagram',
				description: 'Postingan terbaru dari Instagram; gambar cadangan dipakai bila feed gagal.',
				fields: [
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
					{
						kind: 'text',
						key: 'handle',
						label: 'Akun Instagram',
						max: 40,
						placeholder: '@naburmoment'
					},
					{
						kind: 'select',
						key: 'count',
						label: 'Jumlah postingan',
						options: [
							{ value: '6', label: '6' },
							{ value: '9', label: '9' }
						]
					},
					{ kind: 'images', key: 'fallback', label: 'Gambar cadangan', max: 9 }
				],
				defaults: { heading: 'Ikuti cerita kami', handle: '@naburmoment', count: '6', fallback: [] }
			}
		]
	},
	{
		key: 'about',
		label: 'Tentang',
		path: 'tentang',
		sections: [
			{
				key: 'hero',
				label: 'Hero',
				fields: [
					{ kind: 'image', key: 'image', label: 'Gambar' },
					{ kind: 'text', key: 'title', label: 'Judul', max: 80 }
				],
				defaults: { image: null, title: 'Tentang Nabur Moment' }
			},
			{
				key: 'story',
				label: 'Cerita',
				fields: [...introFields, { kind: 'image', key: 'image', label: 'Gambar' }],
				defaults: {
					eyebrow: 'Cerita kami',
					headline: 'Berawal dari kecintaan pada momen kecil',
					body: '<p>Tulis cerita singkat tentang Nabur Moment di sini.</p>',
					image: null
				}
			},
			{
				key: 'approach',
				label: 'Cara kami bekerja',
				fields: [
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
					{
						kind: 'list',
						key: 'blocks',
						label: 'Poin',
						itemLabel: 'Poin',
						max: 3,
						fields: [
							{ kind: 'text', key: 'title', label: 'Judul', max: 60 },
							{ kind: 'textarea', key: 'text', label: 'Teks', max: 300 }
						]
					}
				],
				defaults: {
					heading: 'Cara kami bekerja',
					blocks: [
						{
							title: 'Kenali cerita',
							text: 'Kami ngobrol dulu tentang kalian dan rencana hari H.'
						},
						{
							title: 'Rekam candid',
							text: 'Kami hadir tanpa mengganggu, merekam momen apa adanya.'
						},
						{ title: 'Kirim cepat', text: 'Konten siap dibagikan tak lama setelah acara.' }
					]
				}
			},
			{
				key: 'team',
				label: 'Tim',
				fields: [
					{
						kind: 'list',
						key: 'members',
						label: 'Anggota',
						itemLabel: 'Anggota tim',
						max: 8,
						fields: [
							{ kind: 'image', key: 'photo', label: 'Foto' },
							{ kind: 'text', key: 'name', label: 'Nama', max: 60 },
							{ kind: 'text', key: 'role', label: 'Peran', max: 60 },
							{ kind: 'textarea', key: 'bio', label: 'Bio singkat', max: 300 }
						]
					}
				],
				defaults: { members: [] }
			},
			{
				key: 'cta',
				label: 'Ajakan booking',
				fields: ctaFields,
				defaults: {
					image: null,
					headline: 'Siap menceritakan hari bahagiamu?',
					button: { label: 'Booking sekarang', href: '/booking' }
				}
			}
		]
	},
	{
		key: 'packages',
		label: 'Paket',
		path: 'paket',
		sections: [
			{
				key: 'intro',
				label: 'Pembuka',
				fields: introFields,
				defaults: {
					eyebrow: 'Paket',
					headline: 'Pilih paket untuk harimu',
					body: '<p>Semua harga sudah termasuk editing. Tambah add-on sesuai kebutuhan.</p>'
				}
			},
			{
				key: 'notes',
				label: 'Catatan',
				fields: [
					{ kind: 'text', key: 'heading', label: 'Judul', max: 80 },
					{ kind: 'richtext', key: 'body', label: 'Isi' }
				],
				defaults: {
					heading: 'Catatan',
					body: '<p>DP 50% untuk mengunci tanggal. Pelunasan pada hari H. Transport di luar kota dihitung terpisah.</p>'
				}
			}
		]
	},
	{
		key: 'faq',
		label: 'FAQ',
		path: 'faq',
		sections: [
			{
				key: 'intro',
				label: 'Pembuka',
				fields: introFields,
				defaults: {
					eyebrow: 'FAQ',
					headline: 'Yang sering ditanyakan',
					body: '<p>Belum menemukan jawabannya? Hubungi kami lewat WhatsApp.</p>'
				}
			},
			{
				key: 'cta',
				label: 'Ajakan booking',
				fields: ctaFields,
				defaults: {
					image: null,
					headline: 'Masih ada pertanyaan?',
					button: { label: 'Hubungi kami', href: '/booking' }
				}
			}
		]
	},
	{
		key: 'portfolio',
		label: 'Portofolio',
		path: 'portofolio',
		sections: [
			{
				key: 'intro',
				label: 'Pembuka',
				fields: introFields,
				defaults: {
					eyebrow: 'Portofolio',
					headline: 'Cerita yang sudah kami rekam',
					body: '<p>Lihat beberapa momen favorit kami.</p>'
				}
			}
		]
	},
	{
		key: 'inquiry',
		label: 'Booking',
		path: 'booking',
		sections: [
			{
				key: 'intro',
				label: 'Pembuka',
				fields: [...introFields, { kind: 'image', key: 'image', label: 'Gambar' }],
				defaults: {
					eyebrow: 'Booking',
					headline: 'Ceritakan rencanamu',
					body: '<p>Isi formulir ini, kami akan menghubungimu lewat WhatsApp.</p>',
					image: null
				}
			},
			{
				key: 'thanks',
				label: 'Terima kasih',
				description: 'Ditampilkan setelah formulir terkirim.',
				fields: [
					{ kind: 'text', key: 'headline', label: 'Judul', max: 80 },
					{ kind: 'richtext', key: 'body', label: 'Isi' }
				],
				defaults: {
					headline: 'Terima kasih!',
					body: '<p>Pesanmu sudah kami terima. Kami akan menghubungimu lewat WhatsApp dalam 1×24 jam.</p>'
				}
			}
		]
	}
];

export const PAGE_BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

export function isPageKey(v: string): v is PageKey {
	return (PAGE_KEYS as readonly string[]).includes(v);
}

export function getSection(page: PageKey, key: string): SectionDef | undefined {
	return PAGE_BY_KEY.get(page)?.sections.find((s) => s.key === key);
}
