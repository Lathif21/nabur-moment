// Section registry (docs/04-ARCHITECTURE.md → CMS content flow): per page, its sections, their
// fields and default content. The Zod schema of each section is built from its fields, so the
// editor (generated from the same fields) and the server never disagree. Client-safe; relative
// imports only.
import { z } from 'zod';

/* ---------- Fields ---------- */

type Base = {
	key: string;
	label: string;
	hint?: string;
	/** Sub-heading shown in the editor above the first field of a group */
	group?: string;
};

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
	fields: (TextField | TextareaField | ImageField | LinkField)[];
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
	/** Starts hidden when the row is first created (optional sections such as a photo hero) */
	startHidden?: boolean;
	/** No Tampilkan switch: the section is part of the page (labels of a list, form, …) */
	alwaysVisible?: boolean;
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

/**
 * Fields missing from stored content (added to the registry after the row was saved) take the
 * section's default, not a blank: a new label keeps its copy on the live site until it is edited.
 */
export function sectionSchema(def: SectionDef) {
	const shape = z.object(Object.fromEntries(def.fields.map((f) => [f.key, fieldSchema(f)])));
	return z.preprocess(
		(v) => (v && typeof v === 'object' && !Array.isArray(v) ? { ...def.defaults, ...v } : v),
		shape
	);
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

/** Photo band at the top of an inner page; off until the owner turns it on */
const pageHero = (eyebrow: string, title: string): SectionDef => ({
	key: 'hero',
	label: 'Hero foto',
	description:
		'Opsional: foto lebar dengan judul di bagian atas halaman. Bila tampil, judul Pembuka menjadi subjudul.',
	startHidden: true,
	fields: [
		{ kind: 'image', key: 'image', label: 'Gambar' },
		{ kind: 'text', key: 'eyebrow', label: 'Label kecil', max: 60 },
		{ kind: 'text', key: 'title', label: 'Judul', max: 80 }
	],
	defaults: { image: null, eyebrow, title }
});

const introFields: Field[] = [
	{ kind: 'text', key: 'eyebrow', label: 'Label kecil', max: 60 },
	{ kind: 'text', key: 'headline', label: 'Judul', max: 120 },
	{ kind: 'richtext', key: 'body', label: 'Paragraf' }
];

/* ---------- Pages ---------- */

export const PAGE_KEYS = ['home', 'about', 'packages', 'faq', 'portfolio', 'inquiry'] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

const BASE_PAGES: PageDef[] = [
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
						kind: 'link',
						key: 'button',
						label: 'Tombol utama',
						hint: 'Kosongkan teks atau tautan untuk menyembunyikan tombol.'
					},
					{ kind: 'link', key: 'button2', label: 'Tombol kedua' },
					{
						kind: 'select',
						key: 'tone',
						label: 'Warna gambar',
						options: [
							{ value: 'mono', label: 'Hitam putih' },
							{ value: 'color', label: 'Berwarna' }
						]
					},
					{
						kind: 'select',
						key: 'overlay',
						label: 'Gelap lapisan di atas gambar',
						hint: 'Lebih gelap = teks lebih mudah dibaca.',
						options: [
							{ value: 'medium', label: 'Sedang' },
							{ value: 'soft', label: 'Tipis' },
							{ value: 'strong', label: 'Tebal' }
						]
					},
					{
						kind: 'text',
						key: 'scrollLabel',
						label: 'Teks ajakan gulir',
						max: 20,
						hint: 'Di pojok kanan bawah. Kosong = disembunyikan.'
					}
				],
				defaults: {
					media: null,
					script: 'Cerita kita',
					headline: 'Momen yang',
					accent: 'tak terulang',
					caption: 'Wedding content creator',
					button: { label: '', href: '' },
					button2: { label: '', href: '' },
					tone: 'mono',
					overlay: 'medium',
					scrollLabel: 'Gulir'
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
				label: 'Portofolio',
				description:
					'Semua album yang sudah diterbitkan tampil di sini, urut seperti di Portofolio.',
				fields: [{ kind: 'text', key: 'heading', label: 'Judul', max: 120 }],
				defaults: { heading: 'Cerita terbaru' }
			},
			{
				key: 'packages',
				label: 'Paket',
				fields: [
					{ kind: 'text', key: 'eyebrow', label: 'Label kecil', max: 60 },
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
					{ kind: 'textarea', key: 'body', label: 'Paragraf', max: 400 },
					{ kind: 'link', key: 'button', label: 'Tombol' }
				],
				defaults: {
					eyebrow: 'Paket',
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
					{ kind: 'text', key: 'eyebrow', label: 'Label kecil', max: 60 },
					{ kind: 'text', key: 'title', label: 'Judul', max: 80 }
				],
				defaults: { image: null, eyebrow: 'Tentang', title: 'Tentang Nabur Moment' }
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
					{ kind: 'text', key: 'heading', label: 'Judul', max: 120 },
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
				defaults: { heading: 'Tim kami', members: [] }
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
			pageHero('Paket', 'Paket & harga'),
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
				key: 'list',
				label: 'Daftar paket',
				description: 'Paket dan add-on diatur di Konten → Paket. Di sini hanya teks di sekitarnya.',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'chooseLabel', label: 'Tombol di kartu paket', max: 30 },
					{ kind: 'text', key: 'addonsHeading', label: 'Judul add-on', max: 60 },
					{ kind: 'text', key: 'emptyText', label: 'Teks bila belum ada paket', max: 120 }
				],
				defaults: {
					chooseLabel: 'Pilih paket',
					addonsHeading: 'Add-on',
					emptyText: 'Paket akan segera tersedia.'
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
			pageHero('FAQ', 'Yang sering ditanyakan'),
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
				key: 'list',
				label: 'Daftar pertanyaan',
				description: 'Pertanyaan diatur di Konten → FAQ.',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'emptyText', label: 'Teks bila belum ada pertanyaan', max: 120 }
				],
				defaults: { emptyText: 'Belum ada pertanyaan.' }
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
			pageHero('Portofolio', 'Cerita yang sudah kami rekam'),
			{
				key: 'intro',
				label: 'Pembuka',
				fields: introFields,
				defaults: {
					eyebrow: 'Portofolio',
					headline: 'Cerita yang sudah kami rekam',
					body: '<p>Lihat beberapa momen favorit kami.</p>'
				}
			},
			{
				key: 'list',
				label: 'Daftar album',
				description: 'Album diatur di Konten → Portofolio.',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'allLabel', label: 'Saringan "semua"', max: 30 },
					{ kind: 'text', key: 'emptyText', label: 'Teks bila belum ada album', max: 120 }
				],
				defaults: { allLabel: 'Semua', emptyText: 'Album akan segera hadir.' }
			},
			{
				key: 'album',
				label: 'Halaman album',
				description: 'Teks di setiap halaman album (/portofolio/…).',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'othersHeading', label: 'Judul album lainnya', max: 80 },
					{ kind: 'link', key: 'button', label: 'Tombol di bawah album lainnya' },
					{
						kind: 'text',
						key: 'playLabel',
						label: 'Tombol putar video sematan',
						max: 30,
						hint: 'Diikuti nama layanan, misalnya "Putar dari YouTube".'
					}
				],
				defaults: {
					othersHeading: 'Album lainnya',
					button: { label: 'Ceritakan hari bahagiamu', href: '/booking' },
					playLabel: 'Putar dari'
				}
			}
		]
	},
	{
		key: 'inquiry',
		label: 'Booking',
		path: 'booking',
		sections: [
			pageHero('Booking', 'Ceritakan rencanamu'),
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
				key: 'form',
				label: 'Formulir',
				description: 'Label setiap isian. Pilihan jenis acara mengikuti data booking.',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'nameLabel', label: 'Label nama', max: 40 },
					{ kind: 'text', key: 'phoneLabel', label: 'Label WhatsApp', max: 40 },
					{ kind: 'text', key: 'phoneHint', label: 'Petunjuk WhatsApp', max: 120 },
					{ kind: 'text', key: 'emailLabel', label: 'Label email', max: 40 },
					{ kind: 'text', key: 'instagramLabel', label: 'Label Instagram', max: 40 },
					{ kind: 'text', key: 'instagramHint', label: 'Petunjuk Instagram', max: 120 },
					{ kind: 'text', key: 'eventTypeLabel', label: 'Label jenis acara', max: 40 },
					{ kind: 'text', key: 'eventDateLabel', label: 'Label tanggal acara', max: 40 },
					{ kind: 'text', key: 'venueLabel', label: 'Label lokasi', max: 40 },
					{ kind: 'text', key: 'cityLabel', label: 'Label kota', max: 40 },
					{ kind: 'text', key: 'packageLabel', label: 'Label paket', max: 40 },
					{ kind: 'text', key: 'packageNone', label: 'Pilihan paket "belum tahu"', max: 40 },
					{ kind: 'text', key: 'sourceLabel', label: 'Label sumber', max: 40 },
					{ kind: 'text', key: 'sourcePlaceholder', label: 'Pilihan sumber kosong', max: 40 },
					{ kind: 'text', key: 'messageLabel', label: 'Label pesan', max: 40 },
					{ kind: 'text', key: 'submitLabel', label: 'Tombol kirim', max: 30 },
					{ kind: 'text', key: 'sendingLabel', label: 'Tombol saat mengirim', max: 30 },
					{ kind: 'text', key: 'errorText', label: 'Pesan bila ada isian salah', max: 120 }
				],
				defaults: {
					nameLabel: 'Nama',
					phoneLabel: 'No. WhatsApp',
					phoneHint: 'Kami menghubungimu lewat nomor ini.',
					emailLabel: 'Email',
					instagramLabel: 'Instagram',
					instagramHint: 'Contoh: @namakamu',
					eventTypeLabel: 'Jenis acara',
					eventDateLabel: 'Tanggal acara (utama)',
					venueLabel: 'Lokasi / venue',
					cityLabel: 'Kota',
					packageLabel: 'Paket yang diminati',
					packageNone: 'Belum tahu',
					sourceLabel: 'Tahu kami dari mana',
					sourcePlaceholder: 'Pilih…',
					messageLabel: 'Pesan',
					submitLabel: 'Kirim',
					sendingLabel: 'Mengirim…',
					errorText: 'Periksa lagi isian yang ditandai.'
				}
			},
			{
				key: 'thanks',
				label: 'Terima kasih',
				description: 'Ditampilkan setelah formulir terkirim.',
				alwaysVisible: true,
				fields: [
					{ kind: 'text', key: 'script', label: 'Teks tulisan tangan', max: 40 },
					{ kind: 'text', key: 'headline', label: 'Judul', max: 80 },
					{ kind: 'richtext', key: 'body', label: 'Isi' },
					{ kind: 'link', key: 'button', label: 'Tombol' }
				],
				defaults: {
					script: 'Terima kasih',
					headline: 'Terima kasih!',
					body: '<p>Pesanmu sudah kami terima. Kami akan menghubungimu lewat WhatsApp dalam 1×24 jam.</p>',
					button: { label: 'Lihat portofolio', href: '/portofolio' }
				}
			}
		]
	}
];

/** Last card on every page: search and share preview; empty fields fall back to Pengaturan → Situs */
export const SEO_SECTION: SectionDef = {
	key: 'seo',
	label: 'SEO & bagikan',
	description: 'Kosongkan untuk memakai judul, deskripsi, dan gambar bawaan dari Pengaturan situs.',
	fields: [
		{ kind: 'text', key: 'title', label: 'Judul halaman (SEO)', max: 70 },
		{ kind: 'textarea', key: 'description', label: 'Deskripsi (SEO)', max: 160 },
		{
			kind: 'image',
			key: 'image',
			label: 'Gambar saat dibagikan',
			hint: 'Ideal 1200 × 630.'
		}
	],
	defaults: { title: '', description: '', image: null }
};

export const PAGES: PageDef[] = BASE_PAGES.map((p) => ({
	...p,
	sections: [...p.sections, SEO_SECTION]
}));

export const PAGE_BY_KEY = new Map(PAGES.map((p) => [p.key, p]));

export function isPageKey(v: string): v is PageKey {
	return (PAGE_KEYS as readonly string[]).includes(v);
}

export function getSection(page: PageKey, key: string): SectionDef | undefined {
	return PAGE_BY_KEY.get(page)?.sections.find((s) => s.key === key);
}
