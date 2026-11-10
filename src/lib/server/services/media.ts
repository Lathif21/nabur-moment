// Media library (docs/04-ARCHITECTURE.md → Media). The browser uploads straight to the bucket with
// presigned PUTs; the server never streams file bytes. Relative imports only.
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, isNull, lt, notExists, or, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { media, mediaUsage, type ImageVariant } from '../db/schema/index.ts';
import { type FileStorage, SITE_BUCKET } from '../storage/files.ts';
import { ServiceError } from './errors.ts';

/** WebP widths made in the browser (only those smaller than the original, plus the original) */
export const IMAGE_WIDTHS = [480, 960, 1600, 2400] as const;
export const VIDEO_MIME = 'video/mp4';
export const IMAGE_MIME = 'image/webp';

export type ImageUpload = {
	kind: 'image';
	filename: string;
	/** Original size, before resizing */
	width: number;
	height: number;
	/** Widths of the WebP renditions the browser made */
	variants: number[];
	alt?: string;
};

export type VideoUpload = {
	kind: 'video';
	filename: string;
	mime: string;
	width?: number;
	height?: number;
	durationS?: number;
};

export type UploadTarget = { key: string; url: string; headers: Record<string, string> };

const folder = (id: string) => `media/${id}`;

function checkImage(input: ImageUpload) {
	const widths = [...new Set(input.variants)].sort((a, b) => a - b);
	if (!widths.length || widths.length > IMAGE_WIDTHS.length + 1)
		throw new ServiceError('Ukuran gambar tidak valid.');
	for (const w of widths) {
		const allowed = (IMAGE_WIDTHS as readonly number[]).includes(w) || w === input.width;
		if (!allowed || w > input.width) throw new ServiceError('Ukuran gambar tidak valid.');
	}
	return widths;
}

/**
 * Step 1 of an upload: a `pending` row and one presigned PUT per file. Images: one WebP per
 * width (`media/{id}/w{width}.webp`); videos: the MP4 and a WebP poster frame.
 */
export async function createUpload(
	db: DbOrTx,
	storage: FileStorage,
	input: ImageUpload | VideoUpload,
	userId: string | null
): Promise<{ id: string; uploads: UploadTarget[] }> {
	const id = randomUUID();
	const filename = input.filename.slice(0, 200);
	let row: typeof media.$inferInsert;
	let files: { key: string; mime: string }[];

	if (input.kind === 'image') {
		const widths = checkImage(input);
		const variants: ImageVariant[] = widths.map((w) => ({ w, key: `${folder(id)}/w${w}.webp` }));
		files = variants.map((v) => ({ key: v.key, mime: IMAGE_MIME }));
		const largest = variants.at(-1)!;
		row = {
			id,
			kind: 'image',
			bucket: SITE_BUCKET,
			key: largest.key,
			variants,
			filename,
			mime: IMAGE_MIME,
			width: largest.w,
			height: Math.round((input.height * largest.w) / input.width),
			alt: input.alt?.trim() ?? ''
		};
	} else {
		if (input.mime !== VIDEO_MIME) throw new ServiceError('Video harus berformat MP4.');
		const key = `${folder(id)}/video.mp4`;
		const posterKey = `${folder(id)}/poster.webp`;
		files = [
			{ key, mime: VIDEO_MIME },
			{ key: posterKey, mime: IMAGE_MIME }
		];
		row = {
			id,
			kind: 'video',
			bucket: SITE_BUCKET,
			key,
			posterKey,
			filename,
			mime: VIDEO_MIME,
			width: input.width,
			height: input.height,
			durationS: input.durationS
		};
	}

	await db.insert(media).values({ ...row, uploadedBy: userId, status: 'pending' });
	const uploads = await Promise.all(
		files.map(async (f) => ({
			key: f.key,
			...(await storage.uploadUrl(SITE_BUCKET, f.key, f.mime))
		}))
	);
	return { id, uploads };
}

/** Every object key a media row owns */
export function mediaKeys(row: {
	key: string | null;
	posterKey: string | null;
	variants: ImageVariant[];
}) {
	return [...new Set([row.key, row.posterKey, ...row.variants.map((v) => v.key)])].filter(
		(k): k is string => !!k
	);
}

/** Step 2: every file must be in the bucket; then the item is `ready` and shows in the library */
export async function confirmUpload(db: DbOrTx, storage: FileStorage, id: string) {
	const [row] = await db.select().from(media).where(eq(media.id, id));
	if (!row) throw new ServiceError('Media tidak ditemukan.');
	if (row.status === 'ready') return row;
	const sizes = await Promise.all(mediaKeys(row).map((k) => storage.size(SITE_BUCKET, k)));
	if (sizes.some((s) => s === null))
		throw new ServiceError('Unggahan belum lengkap. Coba unggah ulang.');
	// Size of the main file (largest variant / the video)
	const bytes = await storage.size(SITE_BUCKET, row.key!);
	const [ready] = await db
		.update(media)
		.set({ status: 'ready', bytes })
		.where(eq(media.id, id))
		.returning();
	return ready;
}

/** Embed providers: the URL decides */
export function parseEmbed(raw: string): {
	provider: 'instagram' | 'tiktok' | 'youtube';
	url: string;
} {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new ServiceError('Tautan tidak valid.', 'url');
	}
	if (url.protocol !== 'https:') throw new ServiceError('Tautan harus diawali https://', 'url');
	const host = url.hostname.replace(/^(www|m)\./, '');
	if (host === 'instagram.com' && /^\/(p|reel|tv)\/[\w-]+/.test(url.pathname))
		return { provider: 'instagram', url: `https://www.instagram.com${url.pathname}` };
	if (host === 'tiktok.com' && /\/video\/\d+/.test(url.pathname))
		return { provider: 'tiktok', url: `https://www.tiktok.com${url.pathname}` };
	if (host === 'youtu.be' && url.pathname.length > 1)
		return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${url.pathname.slice(1)}` };
	if (host === 'youtube.com') {
		const v = url.searchParams.get('v') ?? url.pathname.match(/^\/(shorts|embed)\/([\w-]+)/)?.[2];
		if (v) return { provider: 'youtube', url: `https://www.youtube.com/watch?v=${v}` };
	}
	throw new ServiceError('Hanya tautan Instagram, TikTok, atau YouTube.', 'url');
}

export async function createEmbed(db: DbOrTx, input: { url: string }, userId: string | null) {
	const { provider, url } = parseEmbed(input.url);
	const [row] = await db
		.insert(media)
		.values({
			kind: 'embed',
			embedProvider: provider,
			embedUrl: url,
			status: 'ready',
			uploadedBy: userId
		})
		.returning();
	return row;
}

/** Longest side of an embed cover; the browser scales the picture down to it */
export const EMBED_COVER_MAX = 1600;
const coverKeyOf = (id: string) => new RegExp(`^media/${id}/cover-[0-9a-f]{8}\\.webp$`);

async function lockEmbed(tx: DbOrTx, id: string) {
	const [row] = await tx
		.select({ kind: media.kind, posterKey: media.posterKey })
		.from(media)
		.where(eq(media.id, id))
		.for('update');
	if (!row || row.kind !== 'embed') throw new ServiceError('Embed tidak ditemukan.');
	return row;
}

/**
 * Embed cover, step 1: a presigned PUT for one WebP. Instagram and TikTok give no thumbnail, so
 * the owner uploads one. Each upload gets a new key, so a replaced cover never shows from cache.
 */
export async function createEmbedCoverUpload(
	db: DbOrTx,
	storage: FileStorage,
	id: string
): Promise<UploadTarget> {
	await lockEmbed(db, id);
	const key = `${folder(id)}/cover-${randomUUID().slice(0, 8)}.webp`;
	return { key, ...(await storage.uploadUrl(SITE_BUCKET, key, IMAGE_MIME)) };
}

/**
 * Embed cover, step 2: the file is in the bucket, so the embed points at it (`poster_key`, the
 * site bucket so deleting the embed removes it too). The previous cover's file is removed.
 */
export async function setEmbedCover(
	db: DbOrTx,
	storage: FileStorage,
	id: string,
	input: { key: string; width: number; height: number }
) {
	if (!coverKeyOf(id).test(input.key)) throw new ServiceError('Sampul tidak valid.');
	for (const v of [input.width, input.height])
		if (!Number.isInteger(v) || v < 1 || v > EMBED_COVER_MAX)
			throw new ServiceError('Ukuran sampul tidak valid.');
	if ((await storage.size(SITE_BUCKET, input.key)) === null)
		throw new ServiceError('Unggahan belum lengkap. Coba unggah ulang.');
	const { old, row } = await db.transaction(async (tx) => {
		const found = await lockEmbed(tx, id);
		const [row] = await tx
			.update(media)
			.set({
				bucket: SITE_BUCKET,
				posterKey: input.key,
				width: input.width,
				height: input.height
			})
			.where(eq(media.id, id))
			.returning();
		return { old: found.posterKey, row };
	});
	if (old && old !== input.key) await removeQuietly(storage, [old]);
	return row;
}

/** Back to no cover (YouTube falls back to its own thumbnail) */
export async function removeEmbedCover(db: DbOrTx, storage: FileStorage, id: string) {
	const { old, row } = await db.transaction(async (tx) => {
		const found = await lockEmbed(tx, id);
		const [row] = await tx
			.update(media)
			.set({ bucket: null, posterKey: null, width: null, height: null })
			.where(eq(media.id, id))
			.returning();
		return { old: found.posterKey, row };
	});
	if (old) await removeQuietly(storage, [old]);
	return row;
}

/** The row already moved on; a file that fails to delete is only an orphan */
async function removeQuietly(storage: FileStorage, keys: string[]) {
	try {
		await storage.remove(SITE_BUCKET, keys);
	} catch (e) {
		console.warn(`media: could not remove ${keys.join(', ')}: ${String(e)}`);
	}
}

/**
 * Library items: files in the public site bucket, and embeds (no bucket, or the site bucket once
 * they have an uploaded cover). Other rows, such as
 * payment proofs in the private bucket (services/payment-proofs.ts), never show in the library or
 * the pickers, cannot go on a page, and cannot be edited or deleted from here.
 */
export const isLibraryMedia = or(isNull(media.bucket), eq(media.bucket, SITE_BUCKET))!;

const usageCount = (db: DbOrTx) =>
	db.$count(mediaUsage, eq(mediaUsage.mediaId, media.id)).as('usage');

/** Columns the admin UI and the site need (see #lib/server/media-view.ts) */
const columns = (db: DbOrTx) => ({
	id: media.id,
	kind: media.kind,
	key: media.key,
	variants: media.variants,
	posterKey: media.posterKey,
	filename: media.filename,
	bytes: media.bytes,
	width: media.width,
	height: media.height,
	durationS: media.durationS,
	alt: media.alt,
	focalX: media.focalX,
	focalY: media.focalY,
	embedProvider: media.embedProvider,
	embedUrl: media.embedUrl,
	createdAt: media.createdAt,
	usage: usageCount(db)
});

/** Ready items by id (pages, sections, albums render them); unknown ids are skipped */
export async function mediaByIds(db: DbOrTx, ids: string[]) {
	if (!ids.length) return [];
	return db
		.select(columns(db))
		.from(media)
		.where(and(inArray(media.id, [...new Set(ids)]), eq(media.status, 'ready'), isLibraryMedia));
}

/** The library grid: ready items, newest first, optionally one kind or only unused ones */
export async function listMedia(
	db: DbOrTx,
	opts: { kind?: 'image' | 'video' | 'embed'; unused?: boolean; limit?: number; before?: Date } = {}
) {
	const where = [eq(media.status, 'ready'), isLibraryMedia];
	if (opts.kind) where.push(eq(media.kind, opts.kind));
	if (opts.before) where.push(lt(media.createdAt, opts.before));
	if (opts.unused)
		where.push(
			notExists(
				db
					.select({ x: sql`1` })
					.from(mediaUsage)
					.where(eq(mediaUsage.mediaId, media.id))
			)
		);
	return db
		.select(columns(db))
		.from(media)
		.where(and(...where))
		.orderBy(desc(media.createdAt))
		.limit(Math.min(opts.limit ?? 60, 200));
}

export async function updateMedia(
	db: DbOrTx,
	id: string,
	input: { alt?: string; focalX?: number; focalY?: number }
) {
	const patch: Partial<typeof media.$inferInsert> = {};
	if (input.alt !== undefined) patch.alt = input.alt.trim().slice(0, 300);
	for (const k of ['focalX', 'focalY'] as const) {
		const v = input[k];
		if (v === undefined) continue;
		if (!(v >= 0 && v <= 1)) throw new ServiceError('Titik fokus harus di antara 0 dan 1.');
		patch[k] = v;
	}
	const done = await db
		.update(media)
		.set(patch)
		.where(and(eq(media.id, id), isLibraryMedia))
		.returning();
	if (!done.length) throw new ServiceError('Media tidak ditemukan.');
	return done[0];
}

/** "Dipakai di …" in the detail drawer */
export function mediaUsageOf(db: DbOrTx, id: string) {
	return db
		.select({
			ownerType: mediaUsage.ownerType,
			ownerId: mediaUsage.ownerId,
			field: mediaUsage.field
		})
		.from(mediaUsage)
		.where(eq(mediaUsage.mediaId, id));
}

/**
 * Deleted only when unused: the row goes first (in a transaction that re-checks usage), then the
 * objects. A failed object delete leaves an orphan file, never a row pointing at nothing.
 */
export async function deleteMedia(db: DbOrTx, storage: FileStorage, id: string) {
	const row = await db.transaction(async (tx) => {
		const [found] = await tx
			.select()
			.from(media)
			.where(and(eq(media.id, id), isLibraryMedia))
			.for('update');
		if (!found) throw new ServiceError('Media tidak ditemukan.');
		const [{ n }] = await tx
			.select({ n: count() })
			.from(mediaUsage)
			.where(eq(mediaUsage.mediaId, id));
		if (n > 0)
			throw new ServiceError(
				`Media ini masih dipakai di ${n} tempat. Lepaskan dulu sebelum menghapus.`
			);
		await tx.delete(media).where(eq(media.id, id));
		return found;
	});
	if (row.bucket) await storage.remove(row.bucket as typeof SITE_BUCKET, mediaKeys(row));
}

/**
 * Rebuilds the usage of one owner (a section, album, package, …) from the media ids it now
 * references. Call it inside the owner's save transaction.
 */
export async function syncUsage(
	db: DbOrTx,
	ownerType: string,
	ownerId: string,
	refs: { field: string; mediaId: string }[]
) {
	await db
		.delete(mediaUsage)
		.where(and(eq(mediaUsage.ownerType, ownerType), eq(mediaUsage.ownerId, ownerId)));
	const unique = [...new Map(refs.map((r) => [`${r.mediaId}|${r.field}`, r])).values()];
	if (!unique.length) return;
	const ids = [...new Set(unique.map((r) => r.mediaId))];
	const found = await db.select({ id: media.id }).from(media).where(inArray(media.id, ids));
	if (found.length !== ids.length) throw new ServiceError('Ada media yang sudah tidak ada.');
	await db.insert(mediaUsage).values(unique.map((r) => ({ ...r, ownerType, ownerId })));
}

/** <img> sources for the site: largest as src, all renditions in srcset */
export function imageSources(
	storage: Pick<FileStorage, 'publicUrl'>,
	row: {
		variants: ImageVariant[];
		width: number | null;
		height: number | null;
	}
) {
	const v = row.variants;
	if (!v.length) return null;
	return {
		src: storage.publicUrl(v.at(-1)!.key),
		srcset: v.map((x) => `${storage.publicUrl(x.key)} ${x.w}w`).join(', '),
		width: row.width ?? undefined,
		height: row.height ?? undefined
	};
}
