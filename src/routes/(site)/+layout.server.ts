import { mediaRefs } from '#lib/cms/sections.ts';
import { SITE_SETTINGS } from '#lib/cms/site-settings.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { db } from '#lib/server/db/index.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import { readSiteSettings } from '#lib/server/services/site-settings.ts';
import { isPreview } from '#lib/server/site.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { LayoutServerLoad } from './$types';

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
	return { site, siteMedia, preview };
};
