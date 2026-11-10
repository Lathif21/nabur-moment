// Crew (client feedback, 11 Nov 2026): the photographers / videographers who work an event. An
// asset, not a user: no login. A booking has 0, 1 or 2 crew (max checked in services/crew.ts).
// No $env / $lib imports.
import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { booking } from './crm.ts';

export const crew = pgTable('crew', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	/** "Fotografer", "Videografer"… free text */
	role: text('role').default('').notNull(),
	/** WhatsApp as 628… (phoneNormalize) */
	phone: text('phone'),
	/** Inactive crew leave the picker; their past bookings keep them */
	active: boolean('active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date())
});

/** Who works a booking. Deleting a crew member with bookings is refused (restrict): deactivate. */
export const bookingCrew = pgTable(
	'booking_crew',
	{
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'cascade' }),
		crewId: uuid('crew_id')
			.notNull()
			.references(() => crew.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		primaryKey({ columns: [t.bookingId, t.crewId] }),
		index('booking_crew_crew_idx').on(t.crewId)
	]
);

export const crewRelations = relations(crew, ({ many }) => ({ bookings: many(bookingCrew) }));

export const bookingCrewRelations = relations(bookingCrew, ({ one }) => ({
	booking: one(booking, { fields: [bookingCrew.bookingId], references: [booking.id] }),
	crew: one(crew, { fields: [bookingCrew.crewId], references: [crew.id] })
}));
