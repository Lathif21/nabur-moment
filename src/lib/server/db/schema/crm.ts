// CRM (docs/02-DATA-MODEL.md → CRM): the client is the person who books, each booking is one
// event with one or more sessions (lamaran, akad, resepsi…). No $env / $lib imports.
import { relations, sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	date,
	index,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

/** Shared with portfolio_album (P1-07): import it from here, never declare a second enum */
export const eventType = pgEnum('event_type', [
	'wedding',
	'akad',
	'resepsi',
	'lamaran',
	'engagement',
	'prewedding',
	'other'
]);

export const bookingStage = pgEnum('booking_stage', [
	'inquiry',
	'consultation',
	'quotation',
	'booked',
	'preparation',
	'event_day',
	'editing',
	'completed',
	'lost'
]);

export const bookingOrigin = pgEnum('booking_origin', ['website_form', 'manual']);

export const activityType = pgEnum('activity_type', [
	'note',
	'call',
	'whatsapp',
	'meeting',
	'stage_change',
	'payment',
	'invoice',
	'expense',
	'system'
]);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date());

/** Lead source lookup (owner-editable; seeded with a dummy list in 0006_crm) */
export const leadSource = pgTable('lead_source', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	/** fractional index */
	position: text('position').notNull(),
	archived: boolean('archived').default(false).notNull(),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const client = pgTable(
	'client',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name').notNull(),
		/** WhatsApp, normalised `628…` by phoneNormalize() */
		phone: text('phone'),
		email: text('email'),
		/** handle without `@` */
		instagram: text('instagram'),
		city: text('city'),
		sourceId: uuid('source_id').references(() => leadSource.id, { onDelete: 'set null' }),
		notes: text('notes'),
		/** soft delete */
		archivedAt: timestamp('archived_at', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('client_phone_idx').on(t.phone),
		index('client_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`)
	]
);

/** Name, price and inclusions copied when the package is picked (site edits don't change bookings) */
export type PackageSnapshot = {
	name: string;
	price: number;
	inclusions: string[];
	category?: string;
};

export const booking = pgTable(
	'booking',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clientId: uuid('client_id')
			.notNull()
			.references(() => client.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		eventType: eventType('event_type').notNull(),
		// FK to package added in P1-05 (the package table arrives there)
		packageId: uuid('package_id'),
		packageSnapshot: jsonb('package_snapshot').$type<PackageSnapshot>(),
		/** whole Rupiah = package price + add-ons (no discounts) */
		agreedPrice: bigint('agreed_price', { mode: 'number' }).default(0).notNull(),
		stage: bookingStage('stage').default('inquiry').notNull(),
		/** fractional index inside its stage column */
		position: text('position').notNull(),
		origin: bookingOrigin('origin').default('manual').notNull(),
		inquiryMessage: text('inquiry_message'),
		lostReason: text('lost_reason'),
		/** set when the DP is paid; required from `booked` on */
		bookedAt: timestamp('booked_at', { withTimezone: true }),
		stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }),
		deliveryLink: text('delivery_link'),
		rawDeliveredOn: date('raw_delivered_on'),
		editedDeliveredOn: date('edited_delivered_on'),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('booking_stage_position_idx').on(t.stage, t.position),
		index('booking_client_idx').on(t.clientId),
		check(
			'booking_booked_needs_dp',
			sql`${t.stage} not in ('booked', 'preparation', 'event_day', 'editing', 'completed') or ${t.bookedAt} is not null`
		),
		check(
			'booking_lost_needs_reason',
			sql`${t.stage} <> 'lost' or (${t.lostReason} is not null and btrim(${t.lostReason}) <> '')`
		),
		check('booking_agreed_price_nonneg', sql`${t.agreedPrice} >= 0`)
	]
);

export const bookingSession = pgTable(
	'booking_session',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'cascade' }),
		eventType: eventType('event_type').notNull(),
		/** nullable until known; the earliest dated session is Hari H */
		date: date('date'),
		/** `HH:mm` */
		startTime: text('start_time'),
		endTime: text('end_time'),
		venue: text('venue'),
		city: text('city'),
		notes: text('notes'),
		/** breaks ties between sessions on the same date */
		sort: smallint('sort').default(0).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('booking_session_date_idx').on(t.date),
		index('booking_session_booking_idx').on(t.bookingId),
		check(
			'booking_session_time_format',
			sql`(${t.startTime} is null or ${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and (${t.endTime} is null or ${t.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`
		)
	]
);

export const bookingAddon = pgTable(
	'booking_addon',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'cascade' }),
		// FK to addon added in P1-05; null = custom line typed on the booking
		addonId: uuid('addon_id'),
		/** snapshot */
		name: text('name').notNull(),
		/** snapshot, whole Rupiah */
		unitPrice: bigint('unit_price', { mode: 'number' }).notNull(),
		qty: smallint('qty').default(1).notNull(),
		createdAt: createdAt()
	},
	(t) => [
		index('booking_addon_booking_idx').on(t.bookingId),
		check('booking_addon_qty_min', sql`${t.qty} >= 1`),
		check('booking_addon_price_nonneg', sql`${t.unitPrice} >= 0`)
	]
);

export const activity = pgTable(
	'activity',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		clientId: uuid('client_id')
			.notNull()
			.references(() => client.id, { onDelete: 'cascade' }),
		bookingId: uuid('booking_id').references(() => booking.id, { onDelete: 'cascade' }),
		type: activityType('type').notNull(),
		body: text('body'),
		/** e.g. `{ from, to }` for stage changes */
		meta: jsonb('meta').$type<Record<string, unknown>>(),
		/** null = system / website form */
		userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
		/** app clock (new Date()), not now() */
		occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
		createdAt: createdAt()
	},
	(t) => [
		index('activity_client_idx').on(t.clientId, t.occurredAt),
		index('activity_booking_idx').on(t.bookingId, t.occurredAt)
	]
);

export const leadSourceRelations = relations(leadSource, ({ many }) => ({
	clients: many(client)
}));

export const clientRelations = relations(client, ({ one, many }) => ({
	source: one(leadSource, { fields: [client.sourceId], references: [leadSource.id] }),
	bookings: many(booking),
	activities: many(activity)
}));

export const bookingRelations = relations(booking, ({ one, many }) => ({
	client: one(client, { fields: [booking.clientId], references: [client.id] }),
	sessions: many(bookingSession),
	addons: many(bookingAddon),
	activities: many(activity)
}));

export const bookingSessionRelations = relations(bookingSession, ({ one }) => ({
	booking: one(booking, { fields: [bookingSession.bookingId], references: [booking.id] })
}));

export const bookingAddonRelations = relations(bookingAddon, ({ one }) => ({
	booking: one(booking, { fields: [bookingAddon.bookingId], references: [booking.id] })
}));

export const activityRelations = relations(activity, ({ one }) => ({
	client: one(client, { fields: [activity.clientId], references: [client.id] }),
	booking: one(booking, { fields: [activity.bookingId], references: [booking.id] }),
	user: one(user, { fields: [activity.userId], references: [user.id] })
}));
