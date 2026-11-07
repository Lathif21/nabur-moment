// Access control (docs/02-DATA-MODEL.md → Auth & access control). The owner bypasses all of this;
// everyone else gets the union of their roles' permissions.
import { relations, sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.ts';

export const crudAction = pgEnum('crud_action', ['create', 'read', 'update', 'delete']);

export const role = pgTable('role', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: text('name').notNull().unique(),
	description: text('description'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const rolePermission = pgTable(
	'role_permission',
	{
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'cascade' }),
		/** One of MODULES in #lib/permissions.ts */
		module: text('module').notNull(),
		action: crudAction('action').notNull()
	},
	(t) => [
		primaryKey({ columns: [t.roleId, t.module, t.action] }),
		// Akses & Peran is owner-only and can never be granted
		check('role_permission_no_access', sql`${t.module} <> 'access'`)
	]
);

export const userRole = pgTable(
	'user_role',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// Deleting an assigned role is refused in the service; restrict keeps the DB honest too
		roleId: uuid('role_id')
			.notNull()
			.references(() => role.id, { onDelete: 'restrict' })
	},
	(t) => [primaryKey({ columns: [t.userId, t.roleId] })]
);

export const roleRelations = relations(role, ({ many }) => ({
	permissions: many(rolePermission),
	users: many(userRole)
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
	role: one(role, { fields: [rolePermission.roleId], references: [role.id] })
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
	user: one(user, { fields: [userRole.userId], references: [user.id] }),
	role: one(role, { fields: [userRole.roleId], references: [role.id] })
}));
