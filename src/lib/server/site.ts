// Public pages: published CMS content, or the draft with `?preview=1` for a logged-in admin who
// may read Halaman. Previews are never cached (docs/04-ARCHITECTURE.md → CMS content flow).
import type { RequestEvent } from '@sveltejs/kit';
import type { ListKey } from '#lib/cms/lists.ts';
import type { PageKey } from '#lib/cms/sections.ts';
import type { MediaItem } from '#lib/media/types.ts';
import { can } from '#lib/permissions.ts';
import { db } from './db/index.ts';
import { toMediaItem } from './media-view.ts';
import { listMediaIds, readList } from './services/cms-lists.ts';
import { pageMediaIds, readPage } from './services/cms-pages.ts';
import { mediaByIds } from './services/media.ts';
import { storage } from './storage/index.ts';

export function isPreview({ url, locals }: Pick<RequestEvent, 'url' | 'locals'>) {
	return (
		url.searchParams.has('preview') && !!locals.perms && can(locals.perms, 'cms_pages', 'read')
	);
}

/** A CMS page; the (site) layout already marks previews as never cached */
export async function loadPublicPage(event: Pick<RequestEvent, 'url' | 'locals'>, page: PageKey) {
	const preview = isPreview(event);
	const sections = await readPage(db, page, { preview });
	const media: Record<string, MediaItem> = {};
	if (storage) {
		for (const m of await mediaByIds(db, pageMediaIds(page, sections))) {
			media[m.id] = toMediaItem(m, storage);
		}
	}
	return { preview, sections, media };
}

/** A CMS list for a public page: published snapshot, or the working copy in preview */
export async function loadPublicList<K extends ListKey>(
	event: Pick<RequestEvent, 'url' | 'locals'>,
	list: K
) {
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
export async function loadPortfolio(event: Pick<RequestEvent, 'url' | 'locals'>) {
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
export async function loadAlbum(event: Pick<RequestEvent, 'url' | 'locals'>, slug: string) {
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
export async function loadFeaturedAlbums(
	event: Pick<RequestEvent, 'url' | 'locals'>,
	count: number
) {
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
