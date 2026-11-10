// Public pages: published CMS content, or the draft with `?preview=1` for a logged-in admin who
// may read Halaman. Previews are never cached (docs/04-ARCHITECTURE.md → CMS content flow).
import type { RequestEvent } from '@sveltejs/kit';
import type { ListKey, PublishedAlbum } from '#lib/cms/lists.ts';
import { albumCoverId } from '#lib/media/cover.ts';
import { PAGE_BY_KEY, PAGES, type PageKey } from '#lib/cms/sections.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { ISR_BYPASS_TOKEN } from '$app/env/private';
import { db } from './db/index.ts';
import { toMediaItem } from './media-view.ts';
import { listMediaIds, readList } from './services/cms-lists.ts';
import { pageMediaIds, readPage } from './services/cms-pages.ts';
import { mediaByIds } from './services/media.ts';
import { ISR_BYPASS_COOKIE } from './isr.ts';
import { storage } from './storage/index.ts';

type SiteEvent = Pick<RequestEvent, 'url' | 'locals' | 'cookies'>;

/** Per-page SEO; empty fields fall back to Pengaturan → Situs in the (site) layout */
export type PageMeta = { title: string; description: string; image: string; noindex?: boolean };

function pageMeta(
	page: PageKey,
	sections: Record<string, { data: Record<string, unknown> }>,
	media: Record<string, MediaItem>
): PageMeta {
	const seo = sections.seo?.data ?? {};
	const image = typeof seo.image === 'string' ? media[seo.image]?.src : undefined;
	return {
		// Beranda uses the site title as is; other pages fall back to their name
		title: String(seo.title || (page === 'home' ? '' : (PAGE_BY_KEY.get(page)?.label ?? ''))),
		description: String(seo.description || ''),
		image: image ?? ''
	};
}

/**
 * Draft preview: `?preview=1` (passed through the ISR cache by `allowQuery` in the (site) layout),
 * an admin who may read Halaman, and, where ISR runs, the bypass cookie set at login. That cookie
 * makes Vercel skip the cache entirely, so a draft render is never stored and shown to visitors.
 */
export function isPreview({ url, locals, cookies }: SiteEvent) {
	if (!url.searchParams.has('preview') || !locals.perms) return false;
	if (ISR_BYPASS_TOKEN && cookies.get(ISR_BYPASS_COOKIE) !== ISR_BYPASS_TOKEN) return false;
	return can(locals.perms, 'cms_pages', 'read');
}

/** A CMS page; the (site) layout already marks previews as never cached */
export async function loadPublicPage(event: SiteEvent, page: PageKey) {
	const preview = isPreview(event);
	const sections = await readPage(db, page, { preview });
	const media: Record<string, MediaItem> = {};
	if (storage) {
		for (const m of await mediaByIds(db, pageMediaIds(page, sections))) {
			media[m.id] = toMediaItem(m, storage);
		}
	}
	return { preview, sections, media, meta: pageMeta(page, sections, media) };
}

/** A CMS list for a public page: published snapshot, or the working copy in preview */
export async function loadPublicList<K extends ListKey>(event: SiteEvent, list: K) {
	const data = await readList(db, list, { preview: isPreview(event) });
	const media: Record<string, MediaItem> = {};
	if (storage) {
		for (const m of await mediaByIds(db, listMediaIds(list, data))) {
			media[m.id] = toMediaItem(m, storage);
		}
	}
	return { data, media };
}

/** Media of the given albums' covers and items, by id */
async function albumMedia(albums: PublishedAlbum[]) {
	const media: Record<string, MediaItem> = {};
	if (!storage) return media;
	const ids = albums.flatMap((a) => [a.cover, ...a.items.map((i) => i.media)]);
	const found = await mediaByIds(
		db,
		ids.filter((v): v is string => !!v)
	);
	for (const m of found) media[m.id] = toMediaItem(m, storage);
	return media;
}

/**
 * Albums with `cover` resolved to what the site shows (see albumCoverId: the chosen cover, else the
 * first item with a picture, so an album of embeds shows its first YouTube still) and `items`
 * dropped: lists only show covers.
 */
function withCovers(albums: PublishedAlbum[], media: Record<string, MediaItem>) {
	const covers: Record<string, MediaItem> = {};
	const list = albums.map(({ items, ...a }) => {
		const cover = albumCoverId({ cover: a.cover, items }, media);
		if (cover) covers[cover] = media[cover];
		return { ...a, cover };
	});
	return { albums: list, media: covers };
}

/** /portofolio and Beranda: every published album (working copy in preview) with its cover */
export async function loadPortfolio(event: SiteEvent) {
	const albums = await readList(db, 'portfolio', { preview: isPreview(event) });
	return withCovers(albums, await albumMedia(albums));
}

/**
 * /portofolio/[slug]: one published album (null when it is not published: hidden or added after
 * the last Terbitkan), plus up to three others for "Album lainnya".
 */
export async function loadAlbum(event: SiteEvent, slug: string) {
	const albums = await readList(db, 'portfolio', { preview: isPreview(event) });
	const found = albums.find((a) => a.slug === slug);
	if (!found) return null;
	const rest = albums.filter((a) => a.id !== found.id).slice(0, 3);
	const media = await albumMedia([found, ...rest]);
	const album = { ...found, cover: albumCoverId(found, media) };
	const others = withCovers(rest, media).albums;
	return { album, others, media };
}

/**
 * Public paths that show a CMS page's content, to revalidate after Terbitkan. Album pages show the
 * Portofolio page's "Halaman album" texts; the thank-you page shows Booking's. No page = site
 * settings (header and footer are on every public page).
 */
export async function publicPathsFor(page?: PageKey): Promise<string[]> {
	const albums = async () => (await readList(db, 'portfolio')).map((a) => `portofolio/${a.slug}`);
	if (!page) return [...PAGES.map((p) => p.path), 'booking/terima-kasih', ...(await albums())];
	const path = PAGE_BY_KEY.get(page)!.path;
	if (page === 'portfolio') return [path, ...(await albums())];
	if (page === 'inquiry') return [path, 'booking/terima-kasih'];
	return [path];
}
