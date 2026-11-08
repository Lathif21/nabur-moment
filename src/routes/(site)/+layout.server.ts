import { mediaRefs } from '#lib/cms/sections.ts';
import { SITE_SETTINGS } from '#lib/cms/site-settings.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { PUBLIC_SITE_URL } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { readSiteSettings } from '#lib/server/services/site-settings.ts';
import { isPreview } from '#lib/server/site.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { LayoutServerLoad } from './$types';

/**
 * Public pages are cached on Vercel (ISR). Terbitkan refreshes them at once through the bypass
 * token (#lib/server/revalidate.ts); the hour is only a backstop. Logged-in admins carry the
 * `__prerender_bypass` cookie (set at login), so they always get a fresh page, drafts in preview.
 * Vercel strips query strings before an ISR function sees them, except those in `allowQuery`:
 * `preview` must pass for the admin's draft preview (each value is its own cache entry; visitors
 * only ever get the published render there, see isPreview). The portfolio filter runs in the browser.
 */
export const config = {
	isr: {
		expiration: 3600,
		bypassToken: process.env.ISR_BYPASS_TOKEN || undefined,
		allowQuery: ['preview']
	}
};

// Header logo, footer contacts and default meta tags come from the published site settings
// (the draft in preview, for admins only).
export const load: LayoutServerLoad = async (event) => {
	const preview = isPreview(event);
	if (preview) event.setHeaders({ 'cache-control': 'private, no-store' });
	const site = await readSiteSettings(db, { preview });
	const siteMedia: Record<string, MediaItem> = {};
	if (storage) {
		const ids = mediaRefs(SITE_SETTINGS, site).map((r) => r.mediaId);
		for (const m of await mediaByIds(db, ids)) siteMedia[m.id] = toMediaItem(m, storage);
	}
	// Canonical / og:url base: the real domain once set, else this deployment's origin
	const origin = (PUBLIC_SITE_URL || event.url.origin).replace(/\/$/, '');
	return { site, siteMedia, preview, origin };
};
