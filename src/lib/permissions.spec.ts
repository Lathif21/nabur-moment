import { describe, expect, it } from 'vitest';
import { adminNavItems, firstAllowedHref, visibleAdminNav } from './nav.ts';
import {
	ALL_PERMISSIONS,
	can,
	GRANTABLE_MODULES,
	isGrantable,
	MODULES,
	normalizeGrants,
	permissionSet
} from './permissions.ts';

describe('permissionSet', () => {
	it('gives the owner every permission, including access', () => {
		const p = permissionSet([], true);
		expect(p.size).toBe(ALL_PERMISSIONS.length);
		expect(can(p, 'access', 'delete')).toBe(true);
		expect(can(p, 'invoices', 'create')).toBe(true);
	});

	it('is the union of all roles of a user', () => {
		const roleA = [{ module: 'clients', action: 'read' as const }];
		const roleB = [
			{ module: 'invoices', action: 'create' as const },
			{ module: 'clients', action: 'update' as const }
		];
		const p = permissionSet([...roleA, ...roleB], false);
		expect([...p].sort()).toEqual(
			['clients:read', 'clients:update', 'invoices:create', 'invoices:read'].sort()
		);
	});

	it('implies read from create, update or delete', () => {
		for (const action of ['create', 'update', 'delete'] as const) {
			const p = permissionSet([{ module: 'expenses', action }], false);
			expect(can(p, 'expenses', 'read')).toBe(true);
		}
	});

	it('never grants access (owner only) to a non-owner', () => {
		const p = permissionSet(
			[
				{ module: 'access', action: 'read' },
				{ module: 'access', action: 'update' }
			],
			false
		);
		expect(p.size).toBe(0);
	});

	it('drops unknown modules and actions a module does not have', () => {
		const p = permissionSet(
			[
				{ module: 'nope', action: 'read' },
				{ module: 'reports', action: 'delete' },
				{ module: 'dashboard', action: 'create' }
			],
			false
		);
		expect(p.size).toBe(0);
	});

	it('gives a user without roles nothing', () => {
		expect(permissionSet([], false).size).toBe(0);
	});
});

describe('grants', () => {
	it('keeps read-only modules read-only', () => {
		for (const key of ['dashboard', 'calendar', 'reports']) {
			expect(isGrantable(key, 'read')).toBe(true);
			expect(isGrantable(key, 'update')).toBe(false);
		}
		expect(isGrantable('cms_pages', 'update')).toBe(true);
		expect(isGrantable('cms_pages', 'delete')).toBe(false);
	});

	it('normalizes ticks for saving, adding read and removing duplicates', () => {
		const rows = normalizeGrants([
			{ module: 'payments', action: 'delete' },
			{ module: 'payments', action: 'read' },
			{ module: 'access', action: 'read' }
		]);
		expect(rows).toEqual([
			{ module: 'payments', action: 'delete' },
			{ module: 'payments', action: 'read' }
		]);
	});

	it('lists every module except access as grantable', () => {
		expect(GRANTABLE_MODULES).toHaveLength(MODULES.length - 1);
		expect(GRANTABLE_MODULES.some((m) => (m.key as string) === 'access')).toBe(false);
	});
});

describe('admin navigation', () => {
	it('uses only known modules', () => {
		const keys = new Set<string>(MODULES.map((m) => m.key));
		for (const item of adminNavItems) expect(keys.has(item.module)).toBe(true);
	});

	it('shows only readable menus; Akses & Peran only to the owner', () => {
		const finance = [...permissionSet([{ module: 'invoices', action: 'create' }], false)];
		const groups = visibleAdminNav(finance);
		expect(groups.map((g) => g.label)).toEqual(['Keuangan']);
		expect(groups[0].items.map((i) => i.label)).toEqual(['Invoice']);

		const owner = visibleAdminNav([...permissionSet([], true)]);
		expect(owner.some((g) => g.label === 'Akses & Peran')).toBe(true);
	});

	it('lands a user without Dashboard on the first allowed page', () => {
		expect(firstAllowedHref(['clients:read'])).toBe('admin/klien');
		expect(firstAllowedHref([])).toBeNull();
	});
});
