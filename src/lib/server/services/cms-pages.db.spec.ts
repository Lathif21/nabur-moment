// P1-03: draft → Terbitkan → public reads; preview reads drafts; revert; alt-text rule; usage.
// Runs on NEON_BRANCH=dev inside a transaction that is rolled back.
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, type Tx } from '../db/client';
import { media, mediaUsage, pageSection } from '../db/schema/index';
import {
	getPageForEdit,
	listPages,
	publishPage,
	readPage,
	revertPage,
	sanitizeRichText,
	saveSectionDraft
} from './cms-pages';
import { ServiceError } from './errors';

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
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

describe('sanitizeRichText', () => {
	it('keeps only p, br, strong, em and safe links', () => {
		expect(
			sanitizeRichText(
				'<h1>x</h1><p onclick="a()"><b>Tebal</b> <i>miring</i><br><a href="https://wa.me/62">WA</a> <a href="javascript:alert(1)">x</a><script>bad()</script></p>'
			)
		).toBe(
			'x<p><strong>Tebal</strong> <em>miring</em><br /><a href="https://wa.me/62" target="_blank" rel="noopener noreferrer">WA</a> <a>x</a></p>'
		);
	});
});

describe.runIf(isDevDb)('CMS pages', () => {
	it('drafts stay private until Terbitkan; preview shows them; revert drops them', () =>
		inRollback(async (tx) => {
			const before = await readPage(tx, 'home');
			const sections = await getPageForEdit(tx, 'home');
			const hero = sections.find((s) => s.key === 'hero')!;

			await saveSectionDraft(
				tx,
				'home',
				'hero',
				{ data: { ...hero.draft, headline: 'Judul uji' }, visible: true },
				null
			);
			expect((await readPage(tx, 'home')).hero.data.headline).toBe(before.hero.data.headline);
			expect((await readPage(tx, 'home', { preview: true })).hero.data.headline).toBe('Judul uji');
			expect((await listPages(tx)).find((p) => p.key === 'home')?.dirty).toBe(true);

			await revertPage(tx, 'home');
			expect((await readPage(tx, 'home', { preview: true })).hero.data.headline).toBe(
				before.hero.data.headline
			);

			// Hiding waits for Terbitkan too
			await saveSectionDraft(
				tx,
				'home',
				'ticker',
				{ data: { words: [{ word: 'Hangat' }] }, visible: false },
				null
			);
			await saveSectionDraft(
				tx,
				'home',
				'hero',
				{ data: { ...hero.draft, headline: 'Judul terbit' }, visible: true },
				null
			);
			expect((await readPage(tx, 'home')).ticker.visible).toBe(true);
			await publishPage(tx, 'home', null);
			const after = await readPage(tx, 'home');
			expect(after.hero.data.headline).toBe('Judul terbit');
			expect(after.ticker).toEqual({ visible: false, data: { words: [{ word: 'Hangat' }] } });
			expect((await listPages(tx)).find((p) => p.key === 'home')?.dirty).toBe(false);
		}));

	it('refuses invalid content and cleans rich text on save', () =>
		inRollback(async (tx) => {
			await expect(
				saveSectionDraft(
					tx,
					'home',
					'hero',
					{ data: { headline: 'x'.repeat(200) }, visible: true },
					null
				)
			).rejects.toBeInstanceOf(ServiceError);
			await expect(
				saveSectionDraft(tx, 'home', 'nope', { data: {}, visible: true }, null)
			).rejects.toBeInstanceOf(ServiceError);
			const saved = await saveSectionDraft(
				tx,
				'home',
				'intro',
				{ data: { body: '<p>Halo<script>x()</script></p>' }, visible: true },
				null
			);
			expect(saved.draft.body).toBe('<p>Halo</p>');
		}));

	it('tracks media usage and requires alt text before publishing an image', () =>
		inRollback(async (tx) => {
			const [img] = await tx
				.insert(media)
				.values({
					kind: 'image',
					bucket: 'site-media',
					key: 'media/x/w480.webp',
					variants: [{ w: 480, key: 'media/x/w480.webp' }],
					filename: 'tanpa-alt.jpg',
					status: 'ready'
				})
				.returning();
			await saveSectionDraft(
				tx,
				'home',
				'intro',
				{ data: { headline: 'Halo', image: img.id }, visible: true },
				null
			);
			const usage = await tx
				.select()
				.from(mediaUsage)
				.where(and(eq(mediaUsage.mediaId, img.id), eq(mediaUsage.ownerType, 'page_section')));
			expect(usage).toEqual([
				{ mediaId: img.id, ownerType: 'page_section', ownerId: 'home:intro', field: 'image' }
			]);

			await expect(publishPage(tx, 'home', null)).rejects.toThrow(/teks alternatif/);
			await tx.update(media).set({ alt: 'Pengantin tersenyum' }).where(eq(media.id, img.id));
			await publishPage(tx, 'home', null);
			expect((await readPage(tx, 'home')).intro.data.image).toBe(img.id);
		}));

	it('optional heroes start hidden; list labels stay visible even when hidden in the editor', () =>
		inRollback(async (tx) => {
			await tx.delete(pageSection).where(eq(pageSection.page, 'packages'));
			const sections = await getPageForEdit(tx, 'packages');
			expect(sections.find((s) => s.key === 'hero')!.draftVisible).toBe(false);
			expect((await readPage(tx, 'packages')).hero.visible).toBe(false);

			const list = sections.find((s) => s.key === 'list')!;
			await saveSectionDraft(
				tx,
				'packages',
				'list',
				{ data: { ...list.draft, chooseLabel: 'Ambil paket' }, visible: false },
				null
			);
			await publishPage(tx, 'packages', null);
			const live = await readPage(tx, 'packages');
			expect(live.list.visible).toBe(true);
			expect(live.list.data.chooseLabel).toBe('Ambil paket');
			expect(live.hero.visible).toBe(false);
		}));
});
