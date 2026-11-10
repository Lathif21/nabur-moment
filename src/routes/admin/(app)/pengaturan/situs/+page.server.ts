import { mediaRefs } from '#lib/cms/sections.ts';
import { SITE_SETTINGS } from '#lib/cms/site-settings.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { db } from '#lib/server/db/index.ts';
import { runSimpleAction } from '#lib/server/forms.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { toMediaItem } from '#lib/server/media-view.ts';
import { revalidate } from '#lib/server/revalidate.ts';
import { mediaByIds } from '#lib/server/services/media.ts';
import {
	getSiteSettingsForEdit,
	publishSiteSettings,
	revertSiteSettings
} from '#lib/server/services/site-settings.ts';
import { publicPathsFor } from '#lib/server/site.ts';
import { storage } from '#lib/server/storage/index.ts';
import type { Actions, PageServerLoad } from './$types';

// Pengaturan → Situs (03-SCREENS B8): identity, contacts, socials, footer, SEO defaults.
// The Instagram connection joins this page in P1-10.
export const load: PageServerLoad = async ({ locals }) => {
	requirePerm(locals, 'site_settings', 'read');
	const settings = await getSiteSettingsForEdit(db);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const ids = mediaRefs(SITE_SETTINGS, settings.draft).map((r) => r.mediaId);
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	return {
		settings,
		media,
		canEdit: can(locals.perms!, 'site_settings', 'update'),
		version: Date.now()
	};
};

export const actions: Actions = {
	publish: async ({ locals }) => {
		const user = requirePerm(locals, 'site_settings', 'update');
		return runSimpleAction(async () => {
			await publishSiteSettings(db, user.id);
			// Header, footer and meta tags are on every public page
			await revalidate(await publicPathsFor());
		}, 'Pengaturan situs diterbitkan.');
	},

	revert: async ({ locals }) => {
		requirePerm(locals, 'site_settings', 'update');
		return runSimpleAction(() => revertSiteSettings(db), 'Draf dikembalikan ke versi terbit.');
	}
};
