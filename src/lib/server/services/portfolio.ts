// Portfolio albums (docs/02-DATA-MODEL.md → portfolio_album, album_item). Working copy here;
// publishing is the 'portfolio' list in cms-lists.ts. Relative imports only.
import { and, asc, count, eq, inArray, max, ne } from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { DbOrTx } from '../db/client.ts';
import { albumItem, media, portfolioAlbum } from '../db/schema/index.ts';
import { ServiceError } from './errors.ts';
import { syncUsage } from './media.ts';

export type EventTypeKey = (typeof portfolioAlbum.eventType.enumValues)[number];

/** "Nadia & Raka" → "nadia-raka" */
export function slugify(title: string): string {
	return (
		title
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/&/g, ' ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'album'
	);
}

async function freeSlug(db: DbOrTx, wanted: string, exceptId?: string) {
	const base = slugify(wanted);
	for (let n = 1; n < 100; n++) {
		const slug = n === 1 ? base : `${base}-${n}`;
		const [clash] = await db
			.select({ id: portfolioAlbum.id })
			.from(portfolioAlbum)
			.where(
				exceptId
					? and(eq(portfolioAlbum.slug, slug), ne(portfolioAlbum.id, exceptId))
					: eq(portfolioAlbum.slug, slug)
			);
		if (!clash) return slug;
	}
	throw new ServiceError('Tidak bisa membuat alamat album. Ubah judulnya.', 'slug');
}

export async function listAlbums(db: DbOrTx) {
	return db
		.select({
			id: portfolioAlbum.id,
			slug: portfolioAlbum.slug,
			title: portfolioAlbum.title,
			eventType: portfolioAlbum.eventType,
			eventDate: portfolioAlbum.eventDate,
			city: portfolioAlbum.city,
			coverMediaId: portfolioAlbum.coverMediaId,
			featured: portfolioAlbum.featured,
			visible: portfolioAlbum.visible,
			position: portfolioAlbum.position,
			items: db.$count(albumItem, eq(albumItem.albumId, portfolioAlbum.id))
		})
		.from(portfolioAlbum)
		.orderBy(asc(portfolioAlbum.position));
}

export async function getAlbum(db: DbOrTx, id: string) {
	const [album] = await db.select().from(portfolioAlbum).where(eq(portfolioAlbum.id, id));
	if (!album) throw new ServiceError('Album tidak ditemukan.');
	const items = await db
		.select({ mediaId: albumItem.mediaId, caption: albumItem.caption })
		.from(albumItem)
		.where(eq(albumItem.albumId, id))
		.orderBy(asc(albumItem.position));
	return { ...album, items };
}

export type AlbumInput = {
	title: string;
	/** Empty = from the title */
	slug: string;
	eventType: EventTypeKey;
	eventDate: string | null;
	venue: string;
	city: string;
	story: string;
	coverMediaId: string | null;
	featured: boolean;
	visible: boolean;
	/** The album's media in order */
	items: { mediaId: string; caption: string }[];
};

/** Create or update an album with its whole media list (one transaction) */
export async function saveAlbum(
	db: DbOrTx,
	id: string | null,
	input: AlbumInput
): Promise<{ id: string; slug: string }> {
	return db.transaction(async (tx) => {
		const ids = [...new Set(input.items.map((i) => i.mediaId))];
		if (ids.length !== input.items.length)
			throw new ServiceError('Ada media yang dipilih dua kali di album ini.');
		if (ids.length) {
			const found = await tx
				.select({ id: media.id })
				.from(media)
				.where(and(inArray(media.id, ids), eq(media.status, 'ready')));
			if (found.length !== ids.length) throw new ServiceError('Ada media yang sudah dihapus.');
		}
		const cover = input.coverMediaId ?? input.items[0]?.mediaId ?? null;
		const slug = await freeSlug(tx, input.slug || input.title, id ?? undefined);
		const values = {
			title: input.title,
			slug,
			eventType: input.eventType,
			eventDate: input.eventDate,
			venue: input.venue,
			city: input.city,
			story: input.story,
			coverMediaId: cover,
			featured: input.featured,
			visible: input.visible
		};

		let albumId: string;
		if (id) {
			const done = await tx
				.update(portfolioAlbum)
				.set(values)
				.where(eq(portfolioAlbum.id, id))
				.returning({ id: portfolioAlbum.id });
			if (!done.length) throw new ServiceError('Album tidak ditemukan.');
			albumId = id;
		} else {
			const [{ last }] = await tx
				.select({ last: max(portfolioAlbum.position) })
				.from(portfolioAlbum);
			const [row] = await tx
				.insert(portfolioAlbum)
				.values({ ...values, position: generateKeyBetween(last ?? null, null) })
				.returning({ id: portfolioAlbum.id });
			albumId = row.id;
		}

		await tx.delete(albumItem).where(eq(albumItem.albumId, albumId));
		if (input.items.length) {
			const keys = generateNKeysBetween(null, null, input.items.length);
			await tx.insert(albumItem).values(
				input.items.map((it, i) => ({
					albumId,
					mediaId: it.mediaId,
					caption: it.caption,
					position: keys[i]
				}))
			);
		}
		await syncUsage(tx, 'portfolio_album', albumId, [
			...(cover ? [{ field: 'cover', mediaId: cover }] : []),
			...input.items.map((it) => ({ field: 'items', mediaId: it.mediaId }))
		]);
		return { id: albumId, slug };
	});
}

export async function deleteAlbum(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		await syncUsage(tx, 'portfolio_album', id, []);
		const done = await tx
			.delete(portfolioAlbum)
			.where(eq(portfolioAlbum.id, id))
			.returning({ id: portfolioAlbum.id });
		if (!done.length) throw new ServiceError('Album tidak ditemukan.');
	});
}

/** For the published snapshot: visible albums in order, with their items */
export async function visibleAlbumsWithItems(db: DbOrTx) {
	const albums = await db
		.select()
		.from(portfolioAlbum)
		.where(eq(portfolioAlbum.visible, true))
		.orderBy(asc(portfolioAlbum.position));
	if (!albums.length) return [];
	const items = await db
		.select({
			albumId: albumItem.albumId,
			media: albumItem.mediaId,
			caption: albumItem.caption
		})
		.from(albumItem)
		.where(
			inArray(
				albumItem.albumId,
				albums.map((a) => a.id)
			)
		)
		.orderBy(asc(albumItem.position));
	return albums.map((a) => ({
		id: a.id,
		slug: a.slug,
		title: a.title,
		eventType: a.eventType,
		eventDate: a.eventDate,
		venue: a.venue,
		city: a.city,
		story: a.story,
		cover: a.coverMediaId,
		featured: a.featured,
		items: items
			.filter((i) => i.albumId === a.id)
			.map((i) => ({ media: i.media, caption: i.caption }))
	}));
}

export async function albumCount(db: DbOrTx) {
	const [{ n }] = await db.select({ n: count() }).from(portfolioAlbum);
	return n;
}
