// P1-01 "Done when": upload + confirm + delete a real object on the `dev` bucket; delete is
// refused while the media is used. Runs only on NEON_BRANCH=dev with storage credentials.
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { media, mediaUsage } from '../db/schema/index';
import { neonStorage, PRIVATE_BUCKET, SITE_BUCKET, storageConfig } from '../storage/files';
import { ServiceError } from './errors';
import { toMediaItem } from '../media-view';
import {
	confirmUpload,
	createEmbed,
	createEmbedCoverUpload,
	createUpload,
	deleteMedia,
	listMedia,
	mediaByIds,
	removeEmbedCover,
	setEmbedCover,
	syncUsage,
	updateMedia
} from './media';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const config = storageConfig(process.env);
const ready = !!url && !!config && process.env.NEON_BRANCH === 'dev';

/** 1×1 WebP, enough for HEAD to see a file */
const WEBP = Uint8Array.from(atob('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='), (c) =>
	c.charCodeAt(0)
);

describe.runIf(ready)('media library on the dev bucket', () => {
	const db = createDb(url!);
	const storage = neonStorage(config!);
	const made: string[] = [];

	afterAll(async () => {
		// Leave nothing behind, even when an assertion failed half-way
		for (const id of made) {
			await db.delete(mediaUsage).where(eq(mediaUsage.mediaId, id));
			await deleteMedia(db, storage, id).catch(() => {});
		}
		await db.$client.end();
	});

	it('uploads, confirms, refuses delete while used, then deletes row and files', async () => {
		const up = await createUpload(
			db,
			storage,
			{ kind: 'image', filename: 'akad.jpg', width: 1200, height: 800, variants: [480, 960, 1200] },
			null
		);
		made.push(up.id);
		expect(up.uploads.map((u) => u.key)).toEqual([
			`media/${up.id}/w480.webp`,
			`media/${up.id}/w960.webp`,
			`media/${up.id}/w1200.webp`
		]);

		// Not confirmable before the files are there
		await expect(confirmUpload(db, storage, up.id)).rejects.toBeInstanceOf(ServiceError);

		// The browser's part: PUT each file with the signed headers
		for (const u of up.uploads) {
			const res = await fetch(u.url, { method: 'PUT', body: WEBP, headers: u.headers });
			expect(res.status, u.key).toBe(200);
		}
		const row = await confirmUpload(db, storage, up.id);
		expect(row.status).toBe('ready');
		expect(row.width).toBe(1200);
		expect(row.height).toBe(800);

		// Public read, long cache
		const pub = await fetch(storage.publicUrl(row.key!));
		expect(pub.status).toBe(200);
		expect(pub.headers.get('cache-control')).toContain('immutable');

		const listed = await listMedia(db, { kind: 'image', limit: 200 });
		expect(listed.find((m) => m.id === up.id)?.usage).toBe(0);

		await updateMedia(db, up.id, { alt: 'Tangan pengantin', focalX: 0.3, focalY: 0.6 });

		// Used by a page section → delete refused, files stay
		await syncUsage(db, 'page_section', 'home:hero', [{ field: 'image', mediaId: up.id }]);
		await expect(deleteMedia(db, storage, up.id)).rejects.toBeInstanceOf(ServiceError);
		expect(await storage.size(SITE_BUCKET, row.key!)).not.toBeNull();
		const unused = await listMedia(db, { unused: true, limit: 200 });
		expect(unused.some((m) => m.id === up.id)).toBe(false);

		// Section no longer uses it → delete removes the row and every file
		await syncUsage(db, 'page_section', 'home:hero', []);
		await deleteMedia(db, storage, up.id);
		expect(await db.select().from(media).where(eq(media.id, up.id))).toHaveLength(0);
		for (const u of up.uploads) expect(await storage.size(SITE_BUCKET, u.key)).toBeNull();
	});

	it('plans a video upload as MP4 + poster and refuses other formats', async () => {
		const up = await createUpload(
			db,
			storage,
			{ kind: 'video', filename: 'reel.mp4', mime: 'video/mp4', width: 1080, height: 1920 },
			null
		);
		made.push(up.id);
		expect(up.uploads.map((u) => u.key)).toEqual([
			`media/${up.id}/video.mp4`,
			`media/${up.id}/poster.webp`
		]);
		await expect(
			createUpload(db, storage, { kind: 'video', filename: 'x.mov', mime: 'video/quicktime' }, null)
		).rejects.toBeInstanceOf(ServiceError);
	});

	it('stores embeds as ready items without files', async () => {
		const row = await createEmbed(db, { url: 'https://youtu.be/dQw4w9WgXcQ' }, null);
		made.push(row.id);
		expect(row).toMatchObject({
			kind: 'embed',
			embedProvider: 'youtube',
			embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			status: 'ready'
		});
	});

	it('sets, replaces and removes an embed cover; deleting the embed removes its file', async () => {
		const row = await createEmbed(db, { url: 'https://www.instagram.com/reel/SpecCover1/' }, null);
		made.push(row.id);
		const view = async () => toMediaItem((await mediaByIds(db, [row.id]))[0], storage);
		expect((await view()).thumb).toBeNull();

		const upload = async () => {
			const t = await createEmbedCoverUpload(db, storage, row.id);
			expect(t.key).toMatch(new RegExp(`^media/${row.id}/cover-[0-9a-f]{8}\\.webp$`));
			// Not confirmable before the file is there
			await expect(
				setEmbedCover(db, storage, row.id, { key: t.key, width: 900, height: 1600 })
			).rejects.toBeInstanceOf(ServiceError);
			const res = await fetch(t.url, { method: 'PUT', body: WEBP, headers: t.headers });
			expect(res.status).toBe(200);
			await setEmbedCover(db, storage, row.id, { key: t.key, width: 900, height: 1600 });
			return t.key;
		};

		const first = await upload();
		let item = await view();
		expect(item).toMatchObject({ coverUploaded: true, poster: null, width: 900, height: 1600 });
		expect(item.thumb).toBe(storage.publicUrl(first));
		// Still an embed in the library
		expect((await listMedia(db, { kind: 'embed', limit: 200 })).some((m) => m.id === row.id)).toBe(
			true
		);

		// Replacing: new key, the old file is gone
		const second = await upload();
		expect(second).not.toBe(first);
		expect(await storage.size(SITE_BUCKET, first)).toBeNull();

		// Keys outside this embed's folder, odd sizes and non-embeds are refused
		const other = await createEmbed(db, { url: 'https://youtu.be/SpecOther01' }, null);
		made.push(other.id);
		await expect(
			setEmbedCover(db, storage, other.id, { key: second, width: 900, height: 1600 })
		).rejects.toBeInstanceOf(ServiceError);
		await expect(
			setEmbedCover(db, storage, row.id, { key: second, width: 9000, height: 1600 })
		).rejects.toBeInstanceOf(ServiceError);

		// Remove → no cover, file gone
		await removeEmbedCover(db, storage, row.id);
		item = await view();
		expect(item).toMatchObject({ coverUploaded: false, thumb: null, width: null });
		expect(await storage.size(SITE_BUCKET, second)).toBeNull();

		// Delete with a cover → the file goes too
		const third = await upload();
		await deleteMedia(db, storage, row.id);
		expect(await storage.size(SITE_BUCKET, third)).toBeNull();
	});

	it('keeps private-bucket rows (payment proofs) out of the library', async () => {
		const [proof] = await db
			.insert(media)
			.values({
				kind: 'image',
				bucket: PRIVATE_BUCKET,
				key: `proofs/spec-${Date.now()}/proof.jpg`,
				variants: [],
				filename: 'bukti.jpg',
				status: 'ready'
			})
			.returning();
		try {
			expect((await listMedia(db, { limit: 200 })).some((m) => m.id === proof.id)).toBe(false);
			expect(await mediaByIds(db, [proof.id])).toHaveLength(0);
			await expect(updateMedia(db, proof.id, { alt: 'x' })).rejects.toBeInstanceOf(ServiceError);
			await expect(deleteMedia(db, storage, proof.id)).rejects.toBeInstanceOf(ServiceError);
			expect(await db.select().from(media).where(eq(media.id, proof.id))).toHaveLength(1);
		} finally {
			await db.delete(media).where(eq(media.id, proof.id));
		}
	});
});
