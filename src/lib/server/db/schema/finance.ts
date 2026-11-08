// Accounting (docs/02-DATA-MODEL.md → Accounting): payment schedule first (P3-01); invoices,
// payments and expenses arrive with P3-02 … P3-05. No $env / $lib imports.
import { relations, sql } from 'drizzle-orm';
import {
	bigint,
	check,
	date,
	index,
	pgEnum,
	pgTable,
	smallint,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { booking } from './crm.ts';

export const installmentKind = pgEnum('installment_kind', ['dp', 'pelunasan', 'other']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.notNull()
		.$onUpdate(() => new Date());

/**
 * Payment schedule: DP (fixed 50% of the agreed price, no due date) + Pelunasan (the rest, due on
 * Hari H). Installments sum to `agreed_price`. Kept by `ensureSchedule` (services/installments.ts).
 */
export const bookingInstallment = pgTable(
	'booking_installment',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'cascade' }),
		kind: installmentKind('kind').notNull(),
		/** whole Rupiah */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		/** DP: none. Pelunasan: the first session date (Hari H) */
		dueDate: date('due_date'),
		/** set on the pelunasan when the booking goes to Batal */
		cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
		sort: smallint('sort').default(0).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('booking_installment_booking_idx').on(t.bookingId),
		// One DP and one pelunasan per booking
		uniqueIndex('booking_installment_one_per_kind')
			.on(t.bookingId, t.kind)
			.where(sql`${t.kind} in ('dp', 'pelunasan')`),
		check('booking_installment_amount_nonneg', sql`${t.amount} >= 0`)
	]
);

export const bookingInstallmentRelations = relations(bookingInstallment, ({ one }) => ({
	booking: one(booking, { fields: [bookingInstallment.bookingId], references: [booking.id] })
}));
