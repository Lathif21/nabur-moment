// Pengaturan → Situs (03-SCREENS B8): one settings "section" that publishes like a page.
// Client-safe; relative imports only.
import type { SectionDef } from './sections.ts';

export const SITE_SETTINGS: SectionDef = {
	key: 'site',
	label: 'Identitas & kontak',
	fields: [
		{ kind: 'text', key: 'businessName', label: 'Nama usaha', max: 80 },
		{
			kind: 'image',
			key: 'logoLight',
			label: 'Logo terang (untuk latar gelap)',
			hint: 'Kosong = logo teks. Sebaiknya PNG atau WebP dengan latar transparan.'
		},
		{ kind: 'image', key: 'logoDark', label: 'Logo gelap (untuk latar terang)' },
		{
			kind: 'text',
			key: 'whatsapp',
			label: 'Nomor WhatsApp',
			max: 20,
			placeholder: '0812-3456-7890'
		},
		{ kind: 'text', key: 'email', label: 'Email', max: 120, placeholder: 'halo@naburmoment.com' },
		{ kind: 'text', key: 'instagram', label: 'Instagram', max: 60, placeholder: '@naburmoment' },
		{ kind: 'text', key: 'tiktok', label: 'TikTok', max: 60, placeholder: '@naburmoment' },
		{ kind: 'textarea', key: 'footerText', label: 'Kalimat di footer', max: 200 },
		{
			kind: 'text',
			key: 'seoTitle',
			label: 'Judul situs (SEO)',
			max: 70,
			hint: 'Muncul di tab browser dan hasil Google.'
		},
		{
			kind: 'textarea',
			key: 'seoDescription',
			label: 'Deskripsi situs (SEO)',
			max: 160,
			hint: 'Maksimal 160 karakter.'
		},
		{
			kind: 'image',
			key: 'shareImage',
			label: 'Gambar saat dibagikan',
			hint: 'Tampil saat tautan situs dibagikan di WhatsApp atau media sosial. Ideal 1200 × 630.'
		}
	],
	defaults: {
		businessName: 'Nabur Moment',
		logoLight: null,
		logoDark: null,
		whatsapp: '',
		email: '',
		instagram: '@naburmoment',
		tiktok: '',
		footerText: 'Mengabadikan momen pernikahan dengan hangat, candid, dan estetik.',
		seoTitle: 'Nabur Moment · Wedding Content Creator',
		seoDescription:
			'Konten pernikahan yang candid dan estetik: lamaran, akad, resepsi. Booking tanggalmu sekarang.',
		shareImage: null
	}
};

/** Published settings as the public layout uses them */
export type SiteSettings = {
	businessName: string;
	logoLight: string | null;
	logoDark: string | null;
	/** Stored as 628… */
	whatsapp: string;
	email: string;
	instagram: string;
	tiktok: string;
	footerText: string;
	seoTitle: string;
	seoDescription: string;
	shareImage: string | null;
};

/** "@nabur", "nabur" or a full https URL → profile URL */
export function socialUrl(kind: 'instagram' | 'tiktok', value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	if (/^https:\/\//.test(v)) return v;
	const handle = v.replace(/^@/, '');
	return kind === 'instagram'
		? `https://www.instagram.com/${handle}/`
		: `https://www.tiktok.com/@${handle}`;
}
