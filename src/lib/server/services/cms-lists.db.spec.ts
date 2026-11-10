// P1-05: lists change nothing on the site until Terbitkan; then hidden items are gone and the
// order matches. Runs on NEON_BRANCH=dev inside a transaction that is rolled back.
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createDb, type Tx } from '../db/client';
import { addon, faqItem, media, mediaUsage, packageCategory, pkg } from '../db/schema/index';
import {
	deleteCategory,
	listFaq,
	listStatus,
	publishList,
	readList,
	reorder,
	saveAddon,
	saveCategory,
	saveFaq,
	savePackage,
	saveTestimonial,
	setVisible
} from './cms-lists';
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
			// Start from empty lists so the spec does not depend on dev content
			await tx.delete(faqItem);
			await tx.delete(pkg);
			await tx.delete(addon);
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

describe.runIf(isDevDb)('CMS lists', () => {
	it('FAQ: create, reorder, hide; public only changes on Terbitkan', () =>
		inRollback(async (tx) => {
			await publishList(tx, 'faq', null);
			const a = await saveFaq(tx, { id: null, question: 'A?', answer: 'a', visible: true });
			const b = await saveFaq(tx, { id: null, question: 'B?', answer: 'b', visible: true });
			const c = await saveFaq(tx, { id: null, question: 'C?', answer: 'c', visible: true });
			expect((await listFaq(tx)).map((r) => r.question)).toEqual(['A?', 'B?', 'C?']);

			await reorder(tx, faqItem, [c.id, a.id, b.id]);
			await setVisible(tx, faqItem, a.id, false);

			expect(await readList(tx, 'faq')).toEqual([]);
			expect((await listStatus(tx, 'faq')).dirty).toBe(true);
			expect((await readList(tx, 'faq', { preview: true })).map((r) => r.question)).toEqual([
				'C?',
				'B?'
			]);

			await publishList(tx, 'faq', null);
			expect((await readList(tx, 'faq')).map((r) => r.question)).toEqual(['C?', 'B?']);
			expect((await listStatus(tx, 'faq')).dirty).toBe(false);

			// Editing a hidden item does not make the list "Belum diterbitkan"
			await saveFaq(tx, { id: a.id, question: 'A2?', answer: 'a', visible: false });
			expect((await listStatus(tx, 'faq')).dirty).toBe(false);
		}));

	it('packages: hidden packages, inactive add-ons and empty categories stay off the site', () =>
		inRollback(async (tx) => {
			const cat = await saveCategory(tx, { id: null, name: 'Uji', subtitle: '1 kru konten' });
			const base = {
				id: null,
				categoryId: cat.id,
				normalPrice: null,
				inclusions: ['Video 1 menit'],
				note: '',
				imageMediaId: null,
				featured: false
			};
			await savePackage(tx, { ...base, name: 'Silver', price: 5_000_000, visible: true });
			await savePackage(tx, {
				...base,
				name: 'Gold Promo',
				price: 8_000_000,
				normalPrice: 10_000_000,
				visible: true
			});
			// Harga normal must be above the price
			await expect(
				savePackage(tx, {
					...base,
					name: 'X',
					price: 5_000_000,
					normalPrice: 5_000_000,
					visible: true
				})
			).rejects.toBeInstanceOf(ServiceError);
			await savePackage(tx, { ...base, name: 'Rahasia', price: 1, visible: false });
			await saveAddon(tx, {
				id: null,
				name: 'Drone',
				price: 1_500_000,
				description: '',
				showOnSite: true,
				active: true
			});
			await saveAddon(tx, {
				id: null,
				name: 'Lama',
				price: 1,
				description: '',
				showOnSite: true,
				active: false
			});
			await publishList(tx, 'packages', null);
			const live = await readList(tx, 'packages');
			const mine = live.categories.find((c) => c.id === cat.id)!;
			expect(mine.packages.map((p) => p.name)).toEqual(['Silver', 'Gold Promo']);
			expect(mine.subtitle).toBe('1 kru konten');
			expect(mine.packages[0]).toMatchObject({ price: 5_000_000, inclusions: ['Video 1 menit'] });
			// No promo: the key is left out, so older published snapshots stay "not dirty"
			expect(mine.packages[0]).not.toHaveProperty('normalPrice');
			expect(mine.packages[1]).toMatchObject({ price: 8_000_000, normalPrice: 10_000_000 });
			expect(live.addons.map((a) => a.name)).toEqual(['Drone']);
			// Dummy categories without visible packages are not shown
			expect(live.categories.every((c) => c.packages.length > 0)).toBe(true);

			await expect(deleteCategory(tx, cat.id)).rejects.toBeInstanceOf(ServiceError);
			const empty = await saveCategory(tx, { id: null, name: 'Kosong', subtitle: '' });
			await deleteCategory(tx, empty.id);
			expect(
				await tx.select().from(packageCategory).where(eq(packageCategory.id, empty.id))
			).toHaveLength(0);
		}));

	it('testimonial photos are tracked while used or published', () =>
		inRollback(async (tx) => {
			const [img] = await tx
				.insert(media)
				.values({
					kind: 'image',
					bucket: 'site-media',
					key: 'media/t/w480.webp',
					variants: [{ w: 480, key: 'media/t/w480.webp' }],
					alt: 'Foto',
					status: 'ready'
				})
				.returning();
			const t = await saveTestimonial(tx, {
				id: null,
				name: 'Nadia & Raka',
				quote: 'Hangat sekali',
				eventLabel: 'Akad',
				photoMediaId: img.id,
				visible: true
			});
			await publishList(tx, 'testimonials', null);
			// The draft row drops the photo, but the published snapshot still shows it
			await saveTestimonial(tx, { ...t, id: t.id, photoMediaId: null });
			const uses = await tx
				.select()
				.from(mediaUsage)
				.where(and(eq(mediaUsage.mediaId, img.id)));
			expect(uses.map((u) => u.ownerType)).toEqual(['list_publish']);
		}));
});
