// Better Auth tables (better-auth 1.7 Drizzle adapter), adapted: timestamps are timestamptz and
// `user` has `is_owner` + `active` (docs/02-DATA-MODEL.md → Auth & access control).
import { relations, sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable(
	'user',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').default(false).notNull(),
		image: text('image'),
		createdAt: tstz('created_at').defaultNow().notNull(),
		updatedAt: tstz('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		/** Bypasses permission checks; exactly one, changed only by script */
		isOwner: boolean('is_owner').default(false).notNull(),
		/** Inactive users cannot log in */
		active: boolean('active').default(true).notNull()
	},
	(t) => [
		uniqueIndex('user_one_owner_idx')
			.on(t.isOwner)
			.where(sql`${t.isOwner}`)
	]
);

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: tstz('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: tstz('created_at').defaultNow().notNull(),
		updatedAt: tstz('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(t) => [index('session_user_id_idx').on(t.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: tstz('access_token_expires_at'),
		refreshTokenExpiresAt: tstz('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: tstz('created_at').defaultNow().notNull(),
		updatedAt: tstz('updated_at')
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('account_user_id_idx').on(t.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: tstz('expires_at').notNull(),
		createdAt: tstz('created_at').defaultNow().notNull(),
		updatedAt: tstz('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('verification_identifier_idx').on(t.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));
