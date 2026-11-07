// P1-01 "Done when": upload + confirm + delete a real object on the `dev` bucket; delete is
// refused while the media is used. Runs only on NEON_BRANCH=dev with storage credentials.
import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/client';
import { media, mediaUsage } from '../db/schema/index';
import { neonStorage, SITE_BUCKET, storageConfig } from '../storage/files';
import { ServiceError } from './errors';
import {
	confirmUpload,
	createEmbed,
	createUpload,
	deleteMedia,
	listMedia,
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
});
