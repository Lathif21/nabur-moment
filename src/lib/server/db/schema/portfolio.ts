// Portfolio albums (docs/02-DATA-MODEL.md → portfolio_album, album_item). A CMS list: the tables
// are the working copy, Terbitkan snapshots the visible albums into list_publish ('portfolio').
// Own file (not cms.ts) because it imports the event_type enum from crm.ts, which imports cms.ts.
import { relations } from 'drizzle-orm';
import { boolean, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { eventType } from './crm.ts';
import { media } from './media.ts';

export const portfolioAlbum = pgTable('portfolio_album', {
	id: uuid('id').primaryKey().defaultRandom(),
	/** From the title; unique, used in /portofolio/[slug] */
	slug: text('slug').notNull().unique(),
	/** "Nadia & Raka" */
	title: text('title').notNull(),
	eventType: eventType('event_type').notNull(),
	eventDate: date('event_date', { mode: 'string' }),
	venue: text('venue').default('').notNull(),
	city: text('city').default('').notNull(),
	story: text('story').default('').notNull(),
	coverMediaId: uuid('cover_media_id').references(() => media.id, { onDelete: 'set null' }),
	/** Shown on Beranda (featured section) */
	featured: boolean('featured').default(false).notNull(),
	/** Hide without deleting; takes effect on Terbitkan */
	visible: boolean('visible').default(true).notNull(),
	position: text('position').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const albumItem = pgTable(
	'album_item',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		albumId: uuid('album_id')
			.notNull()
			.references(() => portfolioAlbum.id, { onDelete: 'cascade' }),
		// Media in an album cannot be deleted (usage tracking + restrict)
		mediaId: uuid('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'restrict' }),
		caption: text('caption').default('').notNull(),
		position: text('position').notNull()
	},
	(t) => [index('album_item_album_idx').on(t.albumId)]
);

export const portfolioAlbumRelations = relations(portfolioAlbum, ({ many }) => ({
	items: many(albumItem)
}));

export const albumItemRelations = relations(albumItem, ({ one }) => ({
	album: one(portfolioAlbum, { fields: [albumItem.albumId], references: [portfolioAlbum.id] })
}));
