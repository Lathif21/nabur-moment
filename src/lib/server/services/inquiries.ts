// Website inquiries (P1-08): the /booking form becomes a client + an Inquiry booking, in one
// transaction (docs/03-SCREENS.md A6). Relative imports only.
import { sql } from 'drizzle-orm';
import { EVENT_TYPE_LABEL, type EventType } from '../../crm.ts';
import type { InquiryInput } from '../../schemas/inquiry.ts';
import type { DbOrTx } from '../db/client.ts';
import { createInquiryBooking } from './bookings.ts';
import { createClient, findClientByPhone } from './clients.ts';

/**
 * Match the client by WhatsApp or create one, then create the booking (stage inquiry, origin
 * website_form, activity). An advisory lock on the number keeps two quick submissions from
 * creating the same client twice. Existing client details are never overwritten by the form.
 */
export async function submitInquiry(db: DbOrTx, input: Omit<InquiryInput, 'website'>) {
	return db.transaction(async (tx) => {
		const phone = input.phone;
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'inquiry:' + phone}))`);

		const existing = await findClientByPhone(tx, phone);
		const clientId =
			existing?.id ??
			(
				await createClient(
					tx,
					{
						name: input.name,
						phone,
						email: input.email,
						instagram: input.instagram,
						city: input.city,
						sourceId: input.sourceId,
						notes: null
					},
					null
				)
			).id;

		const eventLabel = EVENT_TYPE_LABEL[input.eventType as EventType] ?? 'Acara';
		const booking = await createInquiryBooking(tx, {
			clientId,
			title: `${eventLabel} ${input.name}`.slice(0, 120),
			eventType: input.eventType as EventType,
			packageId: input.packageId,
			message: input.message,
			sessionDate: input.eventDate,
			venue: input.venue,
			city: input.city
		});
		return { bookingId: booking.id, clientId, newClient: !existing };
	});
}
