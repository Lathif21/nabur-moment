// Access matrix rows (docs/02-DATA-MODEL.md → Modules) and the permission rules. Client-safe and
// shared by the server guards, the sidebar, buttons and the role editor (P0-06), so they never
// disagree. Relative imports only (services use this).

export const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'] as const;
export type CrudAction = (typeof CRUD_ACTIONS)[number];

export const ACTION_LABELS: Record<CrudAction, string> = {
	read: 'Lihat',
	create: 'Tambah',
	update: 'Ubah',
	delete: 'Hapus'
};

const ALL = CRUD_ACTIONS;
const READ_ONLY = ['read'] as const;
const READ_UPDATE = ['read', 'update'] as const;

export const MODULES = [
	{ key: 'dashboard', label: 'Dashboard', group: 'CRM', actions: READ_ONLY },
	{ key: 'calendar', label: 'Kalender', group: 'CRM', actions: READ_ONLY },
	{ key: 'clients', label: 'Klien', group: 'CRM', actions: ALL },
	{ key: 'bookings', label: 'Booking', group: 'CRM', actions: ALL },
	{ key: 'crew', label: 'Kru', group: 'CRM', actions: ALL },
	{ key: 'invoices', label: 'Invoice', group: 'Keuangan', actions: ALL },
	{ key: 'payments', label: 'Pembayaran', group: 'Keuangan', actions: ALL },
	{ key: 'expenses', label: 'Pengeluaran', group: 'Keuangan', actions: ALL },
	{ key: 'reports', label: 'Laba Rugi', group: 'Keuangan', actions: READ_ONLY },
	// Publishing counts as update
	{ key: 'cms_pages', label: 'Halaman', group: 'Konten', actions: READ_UPDATE },
	{ key: 'cms_portfolio', label: 'Portofolio', group: 'Konten', actions: ALL },
	{ key: 'cms_packages', label: 'Paket', group: 'Konten', actions: ALL },
	{ key: 'cms_testimonials', label: 'Testimoni', group: 'Konten', actions: ALL },
	{ key: 'cms_faq', label: 'FAQ', group: 'Konten', actions: ALL },
	{ key: 'media', label: 'Media', group: 'Konten', actions: ALL },
	{ key: 'site_settings', label: 'Situs', group: 'Pengaturan', actions: READ_UPDATE },
	{ key: 'business_settings', label: 'Bisnis & Keuangan', group: 'Pengaturan', actions: ALL },
	// Owner only: never in a role, not shown in the role editor
	{ key: 'access', label: 'Akses & Peran', group: 'Pengaturan', actions: ALL }
] as const satisfies readonly {
	key: string;
	label: string;
	group: 'CRM' | 'Keuangan' | 'Konten' | 'Pengaturan';
	actions: readonly CrudAction[];
}[];

export type ModuleKey = (typeof MODULES)[number]['key'];
export type Permission = `${ModuleKey}:${CrudAction}`;

/** Modules a role can hold (everything except `access`) */
export const GRANTABLE_MODULES = MODULES.filter((m) => m.key !== 'access');

const byKey = new Map<string, (typeof MODULES)[number]>(MODULES.map((m) => [m.key, m]));

export function isModuleKey(key: string): key is ModuleKey {
	return byKey.has(key);
}

/** Whether a role may hold this module + action (known module, allowed action, not `access`) */
export function isGrantable(module: string, action: CrudAction): boolean {
	const m = byKey.get(module);
	return !!m && m.key !== 'access' && (m.actions as readonly CrudAction[]).includes(action);
}

/**
 * Cleans a role's ticks for saving: drops unknown / ungrantable pairs and adds `read` wherever
 * create, update or delete is ticked (C/U/D ⇒ R).
 */
export function normalizeGrants(grants: { module: string; action: CrudAction }[]) {
	const out = new Set<Permission>();
	for (const { module, action } of grants) {
		if (!isGrantable(module, action)) continue;
		out.add(`${module}:${action}` as Permission);
		out.add(`${module}:read` as Permission);
	}
	return [...out].map((p) => {
		const [module, action] = p.split(':') as [ModuleKey, CrudAction];
		return { module, action };
	});
}

/** Every permission there is: what the owner gets */
export const ALL_PERMISSIONS: readonly Permission[] = MODULES.flatMap((m) =>
	m.actions.map((a) => `${m.key}:${a}` as Permission)
);

/**
 * A user's permission set. Owner = everything. Others = the union of their roles' rows, with
 * C/U/D ⇒ R, and never `access` (owner only) or an action the module does not have.
 */
export function permissionSet(
	rows: { module: string; action: CrudAction }[],
	isOwner: boolean
): Set<Permission> {
	if (isOwner) return new Set(ALL_PERMISSIONS);
	return new Set(normalizeGrants(rows).map((g) => `${g.module}:${g.action}` as Permission));
}

/** The check used by guards, the sidebar and buttons */
export function can(
	perms: ReadonlySet<string> | readonly string[],
	module: ModuleKey,
	action: CrudAction = 'read'
): boolean {
	const key = `${module}:${action}`;
	return Array.isArray(perms) ? perms.includes(key) : (perms as ReadonlySet<string>).has(key);
}
