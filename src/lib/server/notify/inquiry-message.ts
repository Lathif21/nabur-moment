// WhatsApp text sent to the owner when a visitor submits /booking. Pure, relative imports only.
import { EVENT_TYPE_LABEL, type EventType } from '../../crm.ts';
import { dateID } from '../../format.ts';

export type InquiryAlert = {
	name: string;
	/** 628… */
	phone: string;
	email: string | null;
	instagram: string | null;
	eventType: string;
	eventDate: string | null;
	venue: string | null;
	city: string | null;
	packageNames: string[];
	message: string | null;
	newClient: boolean;
	/** Absolute link to the booking in the admin, when the site URL is known */
	bookingUrl: string | null;
};

/** OpenWA rejects text longer than 4096 characters */
export const MAX_TEXT = 4096;

export function inquiryAlertText(a: InquiryAlert): string {
	const place = [a.venue, a.city].filter(Boolean).join(', ');
	const details = [
		`Nama: ${a.name}${a.newClient ? '' : ' (klien lama)'}`,
		`WhatsApp: https://wa.me/${a.phone}`,
		a.email && `Email: ${a.email}`,
		a.instagram && `Instagram: ${a.instagram}`,
		`Acara: ${EVENT_TYPE_LABEL[a.eventType as EventType] ?? a.eventType}`,
		`Tanggal: ${a.eventDate ? dateID(a.eventDate, 'long') : 'belum ditentukan'}`,
		place && `Lokasi: ${place}`,
		`Paket: ${a.packageNames.length ? a.packageNames.join(', ') : 'belum tahu'}`
	].filter(Boolean);
	const blocks = [
		'*Inquiry baru dari website*',
		details.join('\n'),
		a.message && `Pesan:\n${a.message}`,
		a.bookingUrl && `Buka booking: ${a.bookingUrl}`
	].filter(Boolean);
	const text = blocks.join('\n\n');
	return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT - 1) + '…' : text;
}
