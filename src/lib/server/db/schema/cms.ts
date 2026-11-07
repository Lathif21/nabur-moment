// CMS pages (docs/02-DATA-MODEL.md → page and page_section). One row per registry section; the
// editor writes `draft`, Terbitkan copies it to `published`. Visibility waits for Terbitkan too.
import {
	boolean,
	jsonb,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

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
