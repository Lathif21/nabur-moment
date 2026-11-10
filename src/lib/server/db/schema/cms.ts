// CMS pages (docs/02-DATA-MODEL.md → page and page_section). One row per registry section; the
// editor writes `draft`, Terbitkan copies it to `published`. Visibility waits for Terbitkan too.
import { sql } from 'drizzle-orm';
import {
	bigint,
	boolean,
	check,
	index,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';
import { media } from './media.ts';

export const pageSection = pgTable(
	'page_section',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** `home`, `about`, `packages`, `faq`, `portfolio`, `inquiry` */
		page: text('page').notNull(),
		/** Section key from the registry, e.g. `hero` */
		key: text('key').notNull(),
		/** Fixed order from the registry */
		sort: smallint('sort').notNull(),
		draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
		draftVisible: boolean('draft_visible').default(true).notNull(),
		published: jsonb('published').$type<Record<string, unknown>>(),
		visible: boolean('visible').default(true).notNull(),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' })
	},
	(t) => [unique('page_section_page_key').on(t.page, t.key)]
);

/** Pengaturan → Situs: a single row (id = 1), draft + published like page sections */
export const siteSettings = pgTable('site_settings', {
	id: smallint('id').primaryKey().default(1),
	draft: jsonb('draft').$type<Record<string, unknown>>().notNull(),
	published: jsonb('published').$type<Record<string, unknown>>(),
	publishedAt: timestamp('published_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' })
});

/* ---------- CMS lists (docs/02-DATA-MODEL.md) ----------
 * The tables are the working copy; Terbitkan copies the visible rows of a list into
 * `list_publish`, which is all the public site reads. `position` is a fractional-indexing key.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
/** Image of a list item; deleting the media sets it to null (usage tracking prevents that) */
const mediaRef = (name: string) => uuid(name).references(() => media.id, { onDelete: 'set null' });

export const packageCategory = pgTable('package_category', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	/** Line under the category heading on /paket; '' = none */
	subtitle: text('subtitle').default('').notNull(),
	position: text('position').notNull(),
	createdAt: createdAt()
});

/** `package` is reserved in strict-mode JS, hence `pkg` */
export const pkg = pgTable(
	'package',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		categoryId: uuid('category_id')
			.notNull()
			.references(() => packageCategory.id, { onDelete: 'restrict' }),
		name: text('name').notNull(),
		/** Whole Rupiah, shown in full on the site */
		price: bigint('price', { mode: 'number' }).notNull(),
		/**
		 * "Harga normal": optional higher price shown struck through next to `price` (a promo).
		 * Display only: bookings and invoices always use `price`.
		 */
		normalPrice: bigint('normal_price', { mode: 'number' }),
		inclusions: text('inclusions').array().default([]).notNull(),
		note: text('note').default('').notNull(),
		imageMediaId: mediaRef('image_media_id'),
		featured: boolean('featured').default(false).notNull(),
		/** Hidden packages stay selectable in bookings */
		visible: boolean('visible').default(true).notNull(),
		position: text('position').notNull(),
		createdAt: createdAt()
	},
	(t) => [
		index('package_category_idx').on(t.categoryId),
		check(
			'package_normal_price_gt_price',
			sql`${t.normalPrice} is null or ${t.normalPrice} > ${t.price}`
		)
	]
);

export const addon = pgTable('addon', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull(),
	price: bigint('price', { mode: 'number' }).notNull(),
	description: text('description').default('').notNull(),
	/** Listed on /paket */
	showOnSite: boolean('show_on_site').default(true).notNull(),
	/** Offered in new bookings */
	active: boolean('active').default(true).notNull(),
	position: text('position').notNull(),
	createdAt: createdAt()
});

export const testimonial = pgTable('testimonial', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** "Nadia & Raka" */
	name: text('name').notNull(),
	quote: text('quote').notNull(),
	/** e.g. "Akad · Bandung, 2026" */
	eventLabel: text('event_label').default('').notNull(),
	photoMediaId: mediaRef('photo_media_id'),
	visible: boolean('visible').default(true).notNull(),
	position: text('position').notNull(),
	createdAt: createdAt()
});

export const faqItem = pgTable('faq_item', {
	id: uuid('id').primaryKey().defaultRandom(),
	question: text('question').notNull(),
	/** Plain text; blank lines separate paragraphs */
	answer: text('answer').notNull(),
	visible: boolean('visible').default(true).notNull(),
	position: text('position').notNull(),
	createdAt: createdAt()
});

/** Published snapshot of each list: `portfolio`, `packages`, `testimonials`, `faq` */
export const listPublish = pgTable('list_publish', {
	list: text('list').primaryKey(),
	data: jsonb('data').$type<unknown>().notNull(),
	publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
	publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' })
});
