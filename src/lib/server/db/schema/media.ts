// Media library (docs/02-DATA-MODEL.md → media, media_usage). Files live in the branch's bucket;
// rows hold the keys. A media row is deleted only when nothing uses it (media_usage empty).
import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

export const mediaKind = pgEnum('media_kind', ['image', 'video', 'embed']);
export const embedProvider = pgEnum('embed_provider', ['instagram', 'tiktok', 'youtube']);
export const mediaStatus = pgEnum('media_status', ['pending', 'ready']);

/** One WebP rendition of an image: width in px and its object key */
export type ImageVariant = { w: number; key: string };

export const media = pgTable(
	'media',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		kind: mediaKind('kind').notNull(),
		/** `site-media` (public) or `private-files`; null for embeds */
		bucket: text('bucket'),
		/** Object key of the original video / the largest image variant */
		key: text('key'),
		/** Images: WebP renditions, smallest first */
		variants: jsonb('variants').$type<ImageVariant[]>().default([]).notNull(),
		/** Videos: poster frame (WebP) */
		posterKey: text('poster_key'),
		/** File name as uploaded, for the library */
		filename: text('filename'),
		mime: text('mime'),
		bytes: integer('bytes'),
		width: integer('width'),
		height: integer('height'),
		durationS: integer('duration_s'),
		/** Required before an image can be used on a published page */
		alt: text('alt').default('').notNull(),
		focalX: real('focal_x').default(0.5).notNull(),
		focalY: real('focal_y').default(0.5).notNull(),
		embedProvider: embedProvider('embed_provider'),
		embedUrl: text('embed_url'),
		uploadedBy: text('uploaded_by').references(() => user.id, { onDelete: 'set null' }),
		/** `pending` until the browser's upload is confirmed */
		status: mediaStatus('status').default('pending').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(t) => [
		index('media_created_idx').on(t.createdAt),
		check('media_focal_range', sql`${t.focalX} between 0 and 1 and ${t.focalY} between 0 and 1`),
		check(
			'media_kind_fields',
			sql`(${t.kind} = 'embed' and ${t.embedUrl} is not null and ${t.embedProvider} is not null)
				or (${t.kind} <> 'embed' and ${t.key} is not null and ${t.bucket} is not null)`
		)
	]
);

/**
 * Where a media item is used: rebuilt on every save of a section, album, package, testimonial or
 * settings. Restrict keeps a used item from being deleted even outside the service.
 */
export const mediaUsage = pgTable(
	'media_usage',
	{
		mediaId: uuid('media_id')
			.notNull()
			.references(() => media.id, { onDelete: 'restrict' }),
		/** e.g. `page_section`, `portfolio_album`, `package`, `testimonial`, `site_settings` */
		ownerType: text('owner_type').notNull(),
		ownerId: text('owner_id').notNull(),
		/** Field inside the owner, e.g. `hero.image`, `media` */
		field: text('field').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.mediaId, t.ownerType, t.ownerId, t.field] }),
		index('media_usage_owner_idx').on(t.ownerType, t.ownerId)
	]
);

export const mediaRelations = relations(media, ({ many }) => ({ usage: many(mediaUsage) }));

export const mediaUsageRelations = relations(mediaUsage, ({ one }) => ({
	media: one(media, { fields: [mediaUsage.mediaId], references: [media.id] })
}));
