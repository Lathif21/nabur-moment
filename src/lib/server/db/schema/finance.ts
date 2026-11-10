// Accounting (docs/02-DATA-MODEL.md → Accounting): payment schedule (P3-01), invoices + counter
// + the payment table (P3-02; payments are recorded in P3-04), app settings (P3-03), expenses
// (P3-05).
// No $env / $lib imports.
import { relations, sql } from 'drizzle-orm';
import {
	bigint,
	check,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	boolean,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { booking } from './crm.ts';
import { media } from './media.ts';

export const installmentKind = pgEnum('installment_kind', ['dp', 'pelunasan', 'other']);
/** `partial` / `paid` come only from payments; `overdue` from the daily check (on read) */
export const invoiceStatus = pgEnum('invoice_status', [
	'draft',
	'sent',
	'partial',
	'paid',
	'overdue',
	'void'
]);
export const paymentMethod = pgEnum('payment_method', ['transfer', 'cash', 'ewallet', 'other']);

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

/**
 * Document sequences, one row per kind and month: `INV-2026-11`, `KW-2026-11`. Bumped with one
 * atomic upsert inside the transaction that writes the document (services/invoices.ts).
 */
export const counter = pgTable('counter', {
	key: text('key').primaryKey(),
	value: integer('value').notNull()
});

/** One invoice line; amounts in whole Rupiah, no discount lines */
export type InvoiceItem = {
	description: string;
	qty: number;
	unitPrice: number;
	/** What the line includes, printed under it: the package contents, an add-on's description */
	details?: string[];
};

/**
 * A numbered bill (INV/NM/{YYYY}/{MM}/{NNN}), never deleted: voided. For an installment invoice
 * `items` are the contract lines (package + add-ons) and `total` is the installment billed; for a
 * custom invoice `total` = the sum of its items.
 */
export const invoice = pgTable(
	'invoice',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		number: text('number').notNull().unique(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'restrict' }),
		installmentId: uuid('installment_id').references(() => bookingInstallment.id, {
			onDelete: 'set null'
		}),
		issueDate: date('issue_date').notNull(),
		dueDate: date('due_date').notNull(),
		items: jsonb('items').$type<InvoiceItem[]>().notNull(),
		/** whole Rupiah billed, no tax */
		total: bigint('total', { mode: 'number' }).notNull(),
		status: invoiceStatus('status').default('draft').notNull(),
		notes: text('notes'),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		voidedAt: timestamp('voided_at', { withTimezone: true }),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('invoice_status_due_idx').on(t.status, t.dueDate),
		index('invoice_booking_idx').on(t.bookingId),
		check('invoice_total_nonneg', sql`${t.total} >= 0`),
		check('invoice_due_after_issue', sql`${t.dueDate} >= ${t.issueDate}`)
	]
);

/**
 * Money in (P3-04 records it; the table arrives with P3-02 so voiding can refuse invoices that
 * have payments). Each payment gets a kwitansi number KW/NM/{YYYY}/{MM}/{NNN}.
 */
export const payment = pgTable(
	'payment',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		bookingId: uuid('booking_id')
			.notNull()
			.references(() => booking.id, { onDelete: 'restrict' }),
		invoiceId: uuid('invoice_id').references(() => invoice.id, { onDelete: 'restrict' }),
		installmentId: uuid('installment_id').references(() => bookingInstallment.id, {
			onDelete: 'set null'
		}),
		receiptNumber: text('receipt_number').notNull().unique(),
		paidOn: date('paid_on').notNull(),
		amount: bigint('amount', { mode: 'number' }).notNull(),
		method: paymentMethod('method').notNull(),
		/** transfer screenshot (private bucket) */
		proofMediaId: uuid('proof_media_id').references(() => media.id, { onDelete: 'set null' }),
		note: text('note'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('payment_booking_idx').on(t.bookingId),
		index('payment_invoice_idx').on(t.invoiceId),
		index('payment_paid_on_idx').on(t.paidOn),
		check('payment_amount_positive', sql`${t.amount} > 0`)
	]
);

export const bookingInstallmentRelations = relations(bookingInstallment, ({ one }) => ({
	booking: one(booking, { fields: [bookingInstallment.bookingId], references: [booking.id] })
}));

/**
 * Business profile printed on invoices and kwitansi + the transfer account shown on invoices
 * (Pengaturan → Bisnis & Keuangan). One row (id = 1), seeded by 0011. Not public content, so no
 * draft / publish. DP is not a setting: always DP_PERCENT.
 */
export const appSettings = pgTable(
	'app_settings',
	{
		id: smallint('id').primaryKey().default(1),
		businessName: text('business_name').default('Nabur Moment').notNull(),
		address: text('address'),
		/** `628…` */
		phone: text('phone'),
		email: text('email'),
		/** handle without `@` */
		instagram: text('instagram'),
		bankName: text('bank_name').default('BCA').notNull(),
		bankNumber: text('bank_number'),
		bankHolder: text('bank_holder'),
		/**
		 * Signature (ttd) on invoices and kwitansi: a transparent PNG in the private bucket, set and
		 * replaced by the owner only. Null = the PDFs keep an empty signature line.
		 */
		signatureKey: text('signature_key'),
		/** Printed under the signature, e.g. "Lathif" + "Owner" */
		signerName: text('signer_name'),
		signerTitle: text('signer_title'),
		updatedAt: updatedAt(),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' })
	},
	(t) => [check('app_settings_single_row', sql`${t.id} = 1`)]
);

/** Expense categories (owner-editable; dummy list seeded by 0012). Delete only when unused. */
export const expenseCategory = pgTable('expense_category', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	/** fractional index */
	position: text('position').notNull(),
	archived: boolean('archived').default(false).notNull(),
	createdAt: createdAt()
});

/**
 * Money out (P3-05). With `booking_id` = a direct cost of that booking; without = overhead.
 * Profit = payments − expenses (both by date). Receipt photo in the private bucket.
 */
export const expense = pgTable(
	'expense',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		spentOn: date('spent_on').notNull(),
		/** whole Rupiah */
		amount: bigint('amount', { mode: 'number' }).notNull(),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => expenseCategory.id, { onDelete: 'restrict' }),
		/** null = overhead */
		bookingId: uuid('booking_id').references(() => booking.id, { onDelete: 'restrict' }),
		description: text('description'),
		method: paymentMethod('method').notNull(),
		receiptMediaId: uuid('receipt_media_id').references(() => media.id, { onDelete: 'set null' }),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('expense_spent_on_idx').on(t.spentOn),
		index('expense_booking_idx').on(t.bookingId),
		index('expense_category_idx').on(t.categoryId),
		check('expense_amount_positive', sql`${t.amount} > 0`)
	]
);
