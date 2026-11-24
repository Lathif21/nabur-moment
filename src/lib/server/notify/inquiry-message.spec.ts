import { describe, expect, it } from 'vitest';
import { inquiryAlertText, MAX_TEXT, type InquiryAlert } from './inquiry-message.ts';

const base: InquiryAlert = {
	name: 'Rina',
	phone: '6281234567890',
	email: null,
	instagram: null,
	eventType: 'zzz',
	eventDate: null,
	venue: null,
	city: null,
	packageNames: [],
	message: null,
	newClient: true,
	bookingUrl: null
};

describe('inquiryAlertText', () => {
	it('lists only the filled fields', () => {
		const text = inquiryAlertText(base);
		expect(text).toBe(
			[
				'*Inquiry baru dari website*',
				'',
				'Nama: Rina',
				'WhatsApp: https://wa.me/6281234567890',
				'Acara: zzz',
				'Tanggal: belum ditentukan',
				'Paket: belum tahu'
			].join('\n')
		);
	});

	it('includes details, message and booking link', () => {
		const text = inquiryAlertText({
			...base,
			email: 'rina@example.com',
			instagram: '@rina',
			eventDate: '2026-12-20',
			venue: 'Gedung A',
			city: 'Bandung',
			packageNames: ['Silver', 'Akad'],
			message: 'Halo',
			newClient: false,
			bookingUrl: 'https://naburmoment.com/admin/booking/abc'
		});
		expect(text).toContain('Nama: Rina (klien lama)');
		expect(text).toContain('Email: rina@example.com');
		expect(text).toContain('Instagram: @rina');
		expect(text).toContain('Tanggal: Minggu, 20 Des 2026');
		expect(text).toContain('Lokasi: Gedung A, Bandung');
		expect(text).toContain('Paket: Silver, Akad');
		expect(text).toContain('\n\nPesan:\nHalo');
		expect(text.endsWith('\n\nBuka booking: https://naburmoment.com/admin/booking/abc')).toBe(true);
	});

	it('stays within the OpenWA text limit', () => {
		const text = inquiryAlertText({ ...base, message: 'x'.repeat(5000) });
		expect(text.length).toBe(MAX_TEXT);
	});
});
