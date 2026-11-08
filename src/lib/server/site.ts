// Public pages: published CMS content, or the draft with `?preview=1` for a logged-in admin who
// may read Halaman. Previews are never cached (docs/04-ARCHITECTURE.md → CMS content flow).
import type { RequestEvent } from '@sveltejs/kit';
import type { ListKey } from '#lib/cms/lists.ts';
import { PAGE_BY_KEY, type PageKey } from '#lib/cms/sections.ts';
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

/** /portofolio: published albums (working copy in preview) with their cover images only */
export async function loadPortfolio(event: SiteEvent) {
	const albums = await readList(db, 'portfolio', { preview: isPreview(event) });
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const covers = albums.map((a) => a.cover).filter((v): v is string => !!v);
		for (const m of await mediaByIds(db, covers)) media[m.id] = toMediaItem(m, storage);
	}
	return { albums, media };
}

/**
 * /portofolio/[slug]: one published album (null when it is not published: hidden or added after
 * the last Terbitkan), plus up to three others for "Album lainnya".
 */
export async function loadAlbum(event: SiteEvent, slug: string) {
	const albums = await readList(db, 'portfolio', { preview: isPreview(event) });
	const album = albums.find((a) => a.slug === slug) ?? null;
	if (!album) return null;
	const others = albums.filter((a) => a.id !== album.id).slice(0, 3);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const ids = [
			...(album.cover ? [album.cover] : []),
			...album.items.map((i) => i.media),
			...others.map((a) => a.cover).filter((v): v is string => !!v)
		];
		for (const m of await mediaByIds(db, ids)) media[m.id] = toMediaItem(m, storage);
	}
	return { album, others, media };
}

/** Beranda "featured": the first `count` published albums flagged featured, covers only */
export async function loadFeaturedAlbums(event: SiteEvent, count: number) {
	const albums = (await readList(db, 'portfolio', { preview: isPreview(event) }))
		.filter((a) => a.featured)
		.slice(0, count);
	const media: Record<string, MediaItem> = {};
	if (storage) {
		const covers = albums.map((a) => a.cover).filter((v): v is string => !!v);
		for (const m of await mediaByIds(db, covers)) media[m.id] = toMediaItem(m, storage);
	}
	return { albums, media };
}
