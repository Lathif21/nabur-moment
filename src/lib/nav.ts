// Navigation for both shells. Client-safe. Labels are UI copy (Bahasa Indonesia).
import type { Component } from 'svelte';
import type { Path } from '$app/types';
import type { ModuleKey } from './permissions.ts';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import SquareKanban from '@lucide/svelte/icons/square-kanban';
import Users from '@lucide/svelte/icons/users';
import Camera from '@lucide/svelte/icons/camera';
import FileText from '@lucide/svelte/icons/file-text';
import Banknote from '@lucide/svelte/icons/banknote';
import Receipt from '@lucide/svelte/icons/receipt';
import ChartLine from '@lucide/svelte/icons/chart-line';
import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left';
import Images from '@lucide/svelte/icons/images';
import Package from '@lucide/svelte/icons/package';
import MessageSquareQuote from '@lucide/svelte/icons/message-square-quote';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import ImageIcon from '@lucide/svelte/icons/image';
import Globe from '@lucide/svelte/icons/globe';
import Building2 from '@lucide/svelte/icons/building-2';
import UserCog from '@lucide/svelte/icons/user-cog';
import ShieldCheck from '@lucide/svelte/icons/shield-check';

type Icon = Component<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;

/* ---------- Public site ---------- */

export type SiteNavItem = { label: string; href: Path };

/** Header nav; "Booking" is rendered as the button */
export const siteNav: SiteNavItem[] = [
	{ label: 'Beranda', href: '' },
	{ label: 'Tentang', href: 'tentang' },
	{ label: 'Portofolio', href: 'portofolio' },
	{ label: 'Paket', href: 'paket' },
	{ label: 'FAQ', href: 'faq' }
];

export const bookingHref: Path = 'booking';

/* ---------- Admin ---------- */

export type AdminNavItem = {
	label: string;
	href: Path;
	icon: Icon;
	/** Permission module; the item shows when the user can read it (`access` = owner only) */
	module: ModuleKey;
};

export type AdminNavGroup = {
	/** Null = top-level links without a heading */
	label: string | null;
	items: AdminNavItem[];
};

export const adminNav: AdminNavGroup[] = [
	{
		label: null,
		items: [
			{ label: 'Dashboard', href: 'admin', icon: LayoutDashboard, module: 'dashboard' },
			{ label: 'Kalender', href: 'admin/kalender', icon: CalendarDays, module: 'calendar' },
			{ label: 'Booking', href: 'admin/booking', icon: SquareKanban, module: 'bookings' },
			{ label: 'Klien', href: 'admin/klien', icon: Users, module: 'clients' },
			{ label: 'Kru', href: 'admin/kru', icon: Camera, module: 'crew' }
		]
	},
	{
		label: 'Keuangan',
		items: [
			{ label: 'Invoice', href: 'admin/keuangan/invoice', icon: FileText, module: 'invoices' },
			{
				label: 'Pembayaran',
				href: 'admin/keuangan/pembayaran',
				icon: Banknote,
				module: 'payments'
			},
			{
				label: 'Pengeluaran',
				href: 'admin/keuangan/pengeluaran',
				icon: Receipt,
				module: 'expenses'
			},
			{
				label: 'Laba Rugi',
				href: 'admin/keuangan/laba-rugi',
				icon: ChartLine,
				module: 'reports'
			}
		]
	},
	{
		label: 'Konten',
		items: [
			{
				label: 'Halaman',
				href: 'admin/konten/halaman',
				icon: PanelsTopLeft,
				module: 'cms_pages'
			},
			{
				label: 'Portofolio',
				href: 'admin/konten/portofolio',
				icon: Images,
				module: 'cms_portfolio'
			},
			{ label: 'Paket', href: 'admin/konten/paket', icon: Package, module: 'cms_packages' },
			{
				label: 'Testimoni',
				href: 'admin/konten/testimoni',
				icon: MessageSquareQuote,
				module: 'cms_testimonials'
			},
			{ label: 'FAQ', href: 'admin/konten/faq', icon: CircleHelp, module: 'cms_faq' },
			{ label: 'Media', href: 'admin/konten/media', icon: ImageIcon, module: 'media' }
		]
	},
	{
		label: 'Pengaturan',
		items: [
			{ label: 'Situs', href: 'admin/pengaturan/situs', icon: Globe, module: 'site_settings' },
			{
				label: 'Bisnis & Keuangan',
				href: 'admin/pengaturan/bisnis',
				icon: Building2,
				module: 'business_settings'
			}
		]
	},
	{
		label: 'Akses & Peran',
		items: [
			{ label: 'Pengguna', href: 'admin/akses/pengguna', icon: UserCog, module: 'access' },
			{ label: 'Peran', href: 'admin/akses/peran', icon: ShieldCheck, module: 'access' }
		]
	}
];

export const adminNavItems: AdminNavItem[] = adminNav.flatMap((g) => g.items);

/** Dashboard matches only itself; every other item also matches its sub-pages. `href` has no leading slash. */
export function isActive(href: string, pathname: string): boolean {
	const path = '/' + href;
	if (href === 'admin') return pathname === '/admin' || pathname === '/admin/';
	return pathname === path || pathname.startsWith(path + '/');
}

/** The sidebar a user sees: items whose module they can read (`access` only for the owner) */
export function visibleAdminNav(perms: readonly string[]): AdminNavGroup[] {
	return adminNav
		.map((g) => ({ ...g, items: g.items.filter((i) => perms.includes(`${i.module}:read`)) }))
		.filter((g) => g.items.length > 0);
}

/** Where to land when the Dashboard is not allowed; null when nothing is */
export function firstAllowedHref(perms: readonly string[]): Path | null {
	return adminNavItems.find((i) => perms.includes(`${i.module}:read`))?.href ?? null;
}
