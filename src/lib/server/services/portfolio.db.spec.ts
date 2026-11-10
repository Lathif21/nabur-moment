// P1-07: albums (slug, items, cover, usage) and publishing through list_publish.
// Runs on NEON_BRANCH=dev inside a transaction that is rolled back.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, type Tx } from '../db/client';
import { media, mediaUsage, portfolioAlbum } from '../db/schema/index';
import { publishList, readList, setVisible } from './cms-lists';
import { ServiceError } from './errors';
import { deleteAlbum, getAlbum, saveAlbum, slugify, type AlbumInput } from './portfolio';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const isDevDb = !!url && process.env.NEON_BRANCH === 'dev';

class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>) {
	const db = createDb(url!);
	try {
		await db.transaction(async (tx) => {
			await tx.delete(portfolioAlbum);
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

async function image(tx: Tx, name: string) {
	const [m] = await tx
		.insert(media)
		.values({
			kind: 'image',
			bucket: 'site-media',
			key: `media/${name}/w480.webp`,
			variants: [{ w: 480, key: `media/${name}/w480.webp` }],
			alt: name,
			status: 'ready'
		})
		.returning();
	return m.id;
}

const base: Omit<AlbumInput, 'title' | 'items'> = {
	slug: '',
	eventType: 'akad',
	eventDate: '2026-10-11',
	venue: '',
	city: 'Bandung',
	story: '',
	coverMediaId: null,
	visible: true
};

describe('slugify', () => {
	it('makes readable URL slugs', () => {
		expect(slugify('Nadia & Raka')).toBe('nadia-raka');
		expect(slugify('  Akad Ayu — Bimo!  ')).toBe('akad-ayu-bimo');
		expect(slugify('Ráisa & Hamish')).toBe('raisa-hamish');
		expect(slugify('&&&')).toBe('album');
	});
});

describe.runIf(isDevDb)('portfolio albums', () => {
	it('saves items in order, picks a cover, keeps slugs unique and tracks usage', () =>
		inRollback(async (tx) => {
			const a = await image(tx, 'a');
			const b = await image(tx, 'b');
			const first = await saveAlbum(tx, null, {
				...base,
				title: 'Nadia & Raka',
				items: [
					{ mediaId: b, caption: 'Akad' },
					{ mediaId: a, caption: '' }
				]
			});
			expect(first.slug).toBe('nadia-raka');
			const again = await saveAlbum(tx, null, { ...base, title: 'Nadia & Raka', items: [] });
			expect(again.slug).toBe('nadia-raka-2');

			const album = await getAlbum(tx, first.id);
			expect(album.items).toEqual([
				{ mediaId: b, caption: 'Akad' },
				{ mediaId: a, caption: '' }
			]);
			// No cover chosen: the first item
			expect(album.coverMediaId).toBe(b);
			const uses = await tx.select().from(mediaUsage).where(eq(mediaUsage.ownerId, first.id));
			expect(uses.map((u) => u.mediaId).sort()).toEqual([a, b, b].sort());

			await expect(
				saveAlbum(tx, first.id, {
					...base,
					title: 'Dobel',
					items: [
						{ mediaId: a, caption: '' },
						{ mediaId: a, caption: '' }
					]
				})
			).rejects.toBeInstanceOf(ServiceError);

			await deleteAlbum(tx, again.id);
			expect(await tx.select().from(portfolioAlbum).where(eq(portfolioAlbum.id, again.id))).toEqual(
				[]
			);
		}));

	it('publishes only visible albums; later changes wait for the next Terbitkan', () =>
		inRollback(async (tx) => {
			const a = await image(tx, 'c');
			const one = await saveAlbum(tx, null, {
				...base,
				title: 'Satu',
				items: [{ mediaId: a, caption: '' }]
			});
			const two = await saveAlbum(tx, null, { ...base, title: 'Dua', items: [] });
			await setVisible(tx, portfolioAlbum, two.id, false);
			await publishList(tx, 'portfolio', null);
			expect((await readList(tx, 'portfolio')).map((x) => x.slug)).toEqual(['satu']);

			// Added after the last Terbitkan: not public yet
			await saveAlbum(tx, null, { ...base, title: 'Tiga', items: [] });
			await setVisible(tx, portfolioAlbum, one.id, false);
			expect((await readList(tx, 'portfolio')).map((x) => x.slug)).toEqual(['satu']);
			expect((await readList(tx, 'portfolio', { preview: true })).map((x) => x.slug)).toEqual([
				'tiga'
			]);

			await publishList(tx, 'portfolio', null);
			expect((await readList(tx, 'portfolio')).map((x) => x.slug)).toEqual(['tiga']);
		}));
});
