// CMS lists: packages (+ categories, add-ons), testimonials, FAQ (docs/02-DATA-MODEL.md →
// list_publish). The tables are the working copy; Terbitkan snapshots the visible rows into
// list_publish, which is all the public site reads. Relative imports only.
import { asc, count, eq, inArray, max } from 'drizzle-orm';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import {
	EMPTY,
	type FaqSnapshot,
	type ListKey,
	type ListSnapshots,
	type PackagesSnapshot,
	type TestimonialSnapshot
} from '../../cms/lists.ts';
import type { DbOrTx } from '../db/client.ts';
import {
	addon,
	faqItem,
	listPublish,
	packageCategory,
	pkg,
	testimonial
} from '../db/schema/index.ts';
import { ServiceError } from './errors.ts';
import { syncUsage } from './media.ts';

type Ordered =
	typeof packageCategory | typeof pkg | typeof addon | typeof testimonial | typeof faqItem;

/* ---------- Order ---------- */

async function nextPosition(db: DbOrTx, table: Ordered, where?: ReturnType<typeof eq>) {
	const t = table as typeof faqItem;
	const [{ last }] = await db
		.select({ last: max(t.position) })
		.from(t)
		.where(where);
	return generateKeyBetween(last ?? null, null);
}

/**
 * Reorder: `ids` is the complete new order of one group (a whole list, or one category's
 * packages). Fresh keys are written for all of them, so concurrent edits cannot collide.
 */
export async function reorder(db: DbOrTx, table: Ordered, ids: string[]) {
	if (!ids.length) return;
	const t = table as typeof faqItem;
	return db.transaction(async (tx) => {
		const rows = await tx.select({ id: t.id }).from(t).where(inArray(t.id, ids));
		if (rows.length !== new Set(ids).size)
			throw new ServiceError('Urutan tidak valid. Muat ulang halaman.');
		const keys = generateNKeysBetween(null, null, ids.length);
		for (const [i, id] of ids.entries()) {
			await tx.update(t).set({ position: keys[i] }).where(eq(t.id, id));
		}
	});
}

/* ---------- FAQ ---------- */

export function listFaq(db: DbOrTx) {
	return db.select().from(faqItem).orderBy(asc(faqItem.position));
}

export async function saveFaq(
	db: DbOrTx,
	input: { id: string | null; question: string; answer: string; visible: boolean }
) {
	const { id, ...data } = input;
	if (id) {
		const done = await db.update(faqItem).set(data).where(eq(faqItem.id, id)).returning();
		if (!done.length) throw new ServiceError('Pertanyaan tidak ditemukan.');
		return done[0];
	}
	const [row] = await db
		.insert(faqItem)
		.values({ ...data, position: await nextPosition(db, faqItem) })
		.returning();
	return row;
}

export async function setVisible(
	db: DbOrTx,
	table: typeof faqItem | typeof testimonial | typeof pkg,
	id: string,
	visible: boolean
) {
	const t = table as typeof faqItem;
	const done = await db.update(t).set({ visible }).where(eq(t.id, id)).returning({ id: t.id });
	if (!done.length) throw new ServiceError('Item tidak ditemukan.');
}

export async function deleteFaq(db: DbOrTx, id: string) {
	const done = await db.delete(faqItem).where(eq(faqItem.id, id)).returning({ id: faqItem.id });
	if (!done.length) throw new ServiceError('Pertanyaan tidak ditemukan.');
}

/* ---------- Testimonials ---------- */

export function listTestimonials(db: DbOrTx) {
	return db.select().from(testimonial).orderBy(asc(testimonial.position));
}

export async function saveTestimonial(
	db: DbOrTx,
	input: {
		id: string | null;
		name: string;
		quote: string;
		eventLabel: string;
		photoMediaId: string | null;
		visible: boolean;
	}
) {
	const { id, ...data } = input;
	return db.transaction(async (tx) => {
		let row;
		if (id) {
			[row] = await tx.update(testimonial).set(data).where(eq(testimonial.id, id)).returning();
			if (!row) throw new ServiceError('Testimoni tidak ditemukan.');
		} else {
			[row] = await tx
				.insert(testimonial)
				.values({ ...data, position: await nextPosition(tx, testimonial) })
				.returning();
		}
		await syncUsage(
			tx,
			'testimonial',
			row.id,
			row.photoMediaId ? [{ field: 'photo', mediaId: row.photoMediaId }] : []
		);
		return row;
	});
}

export async function deleteTestimonial(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		await syncUsage(tx, 'testimonial', id, []);
		const done = await tx
			.delete(testimonial)
			.where(eq(testimonial.id, id))
			.returning({ id: testimonial.id });
		if (!done.length) throw new ServiceError('Testimoni tidak ditemukan.');
	});
}

/* ---------- Packages ---------- */

export function listCategories(db: DbOrTx) {
	return db
		.select({
			id: packageCategory.id,
			name: packageCategory.name,
			position: packageCategory.position,
			packages: db.$count(pkg, eq(pkg.categoryId, packageCategory.id))
		})
		.from(packageCategory)
		.orderBy(asc(packageCategory.position));
}

export async function saveCategory(db: DbOrTx, input: { id: string | null; name: string }) {
	if (input.id) {
		const done = await db
			.update(packageCategory)
			.set({ name: input.name })
			.where(eq(packageCategory.id, input.id))
			.returning();
		if (!done.length) throw new ServiceError('Kategori tidak ditemukan.');
		return done[0];
	}
	const [row] = await db
		.insert(packageCategory)
		.values({ name: input.name, position: await nextPosition(db, packageCategory) })
		.returning();
	return row;
}

/** Refused while the category still has packages */
export async function deleteCategory(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		const [{ n }] = await tx.select({ n: count() }).from(pkg).where(eq(pkg.categoryId, id));
		if (n > 0)
			throw new ServiceError(
				`Kategori ini masih berisi ${n} paket. Pindahkan atau hapus paketnya dulu.`
			);
		const done = await tx
			.delete(packageCategory)
			.where(eq(packageCategory.id, id))
			.returning({ id: packageCategory.id });
		if (!done.length) throw new ServiceError('Kategori tidak ditemukan.');
	});
}

export function listPackages(db: DbOrTx) {
	return db.select().from(pkg).orderBy(asc(pkg.position));
}

export async function savePackage(
	db: DbOrTx,
	input: {
		id: string | null;
		categoryId: string;
		name: string;
		price: number;
		inclusions: string[];
		note: string;
		imageMediaId: string | null;
		featured: boolean;
		visible: boolean;
	}
) {
	const { id, ...data } = input;
	return db.transaction(async (tx) => {
		const [cat] = await tx
			.select({ id: packageCategory.id })
			.from(packageCategory)
			.where(eq(packageCategory.id, data.categoryId));
		if (!cat) throw new ServiceError('Kategori tidak ditemukan.', 'categoryId');
		let row;
		if (id) {
			const [old] = await tx.select({ categoryId: pkg.categoryId }).from(pkg).where(eq(pkg.id, id));
			if (!old) throw new ServiceError('Paket tidak ditemukan.');
			// Moving to another category puts it at the end there
			const position =
				old.categoryId === data.categoryId
					? undefined
					: await nextPosition(tx, pkg, eq(pkg.categoryId, data.categoryId));
			[row] = await tx
				.update(pkg)
				.set({ ...data, ...(position ? { position } : {}) })
				.where(eq(pkg.id, id))
				.returning();
		} else {
			[row] = await tx
				.insert(pkg)
				.values({
					...data,
					position: await nextPosition(tx, pkg, eq(pkg.categoryId, data.categoryId))
				})
				.returning();
		}
		await syncUsage(
			tx,
			'package',
			row.id,
			row.imageMediaId ? [{ field: 'image', mediaId: row.imageMediaId }] : []
		);
		return row;
	});
}

export async function deletePackage(db: DbOrTx, id: string) {
	return db.transaction(async (tx) => {
		await syncUsage(tx, 'package', id, []);
		const done = await tx.delete(pkg).where(eq(pkg.id, id)).returning({ id: pkg.id });
		if (!done.length) throw new ServiceError('Paket tidak ditemukan.');
	});
}

export function listAddons(db: DbOrTx) {
	return db.select().from(addon).orderBy(asc(addon.position));
}

export async function saveAddon(
	db: DbOrTx,
	input: {
		id: string | null;
		name: string;
		price: number;
		description: string;
		showOnSite: boolean;
		active: boolean;
	}
) {
	const { id, ...data } = input;
	if (id) {
		const done = await db.update(addon).set(data).where(eq(addon.id, id)).returning();
		if (!done.length) throw new ServiceError('Add-on tidak ditemukan.');
		return done[0];
	}
	const [row] = await db
		.insert(addon)
		.values({ ...data, position: await nextPosition(db, addon) })
		.returning();
	return row;
}

export async function deleteAddon(db: DbOrTx, id: string) {
	const done = await db.delete(addon).where(eq(addon.id, id)).returning({ id: addon.id });
	if (!done.length) throw new ServiceError('Add-on tidak ditemukan.');
}

/* ---------- Snapshots + publishing ---------- */

/** What Terbitkan would publish right now (visible rows, in order) */
export async function snapshot<K extends ListKey>(db: DbOrTx, list: K): Promise<ListSnapshots[K]> {
	if (list === 'faq') {
		const rows = await listFaq(db);
		return rows
			.filter((r) => r.visible)
			.map((r) => ({
				id: r.id,
				question: r.question,
				answer: r.answer
			})) satisfies FaqSnapshot as ListSnapshots[K];
	}
	if (list === 'testimonials') {
		const rows = await listTestimonials(db);
		return rows
			.filter((r) => r.visible)
			.map((r) => ({
				id: r.id,
				name: r.name,
				quote: r.quote,
				eventLabel: r.eventLabel,
				photo: r.photoMediaId
			})) satisfies TestimonialSnapshot as ListSnapshots[K];
	}
	const [cats, packages, addons] = await Promise.all([
		listCategories(db),
		listPackages(db),
		listAddons(db)
	]);
	const data: PackagesSnapshot = {
		categories: cats
			.map((c) => ({
				id: c.id,
				name: c.name,
				packages: packages
					.filter((p) => p.categoryId === c.id && p.visible)
					.map((p) => ({
						id: p.id,
						name: p.name,
						price: p.price,
						inclusions: p.inclusions,
						note: p.note,
						image: p.imageMediaId,
						featured: p.featured
					}))
			}))
			.filter((c) => c.packages.length > 0),
		addons: addons
			.filter((a) => a.active && a.showOnSite)
			.map((a) => ({ id: a.id, name: a.name, price: a.price, description: a.description }))
	};
	return data as ListSnapshots[K];
}

/** Media ids inside a snapshot (the published site still shows them) */
function snapshotMedia(list: ListKey, data: unknown): string[] {
	if (list === 'testimonials')
		return (data as TestimonialSnapshot).map((t) => t.photo).filter((v): v is string => !!v);
	if (list === 'packages')
		return (data as PackagesSnapshot).categories
			.flatMap((c) => c.packages.map((p) => p.image))
			.filter((v): v is string => !!v);
	return [];
}

/** JSON with sorted keys: Postgres jsonb does not keep key order */
function stable(v: unknown): string {
	return JSON.stringify(v, (_, x) =>
		x && typeof x === 'object' && !Array.isArray(x)
			? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
			: x
	);
}

/** "Belum diterbitkan": the list differs from what is live */
export async function listStatus(db: DbOrTx, list: ListKey) {
	const [row] = await db.select().from(listPublish).where(eq(listPublish.list, list));
	const current = await snapshot(db, list);
	const live = row?.data ?? EMPTY[list];
	return {
		dirty: stable(current) !== stable(live),
		publishedAt: row?.publishedAt ?? null
	};
}

/** Terbitkan: snapshot the visible rows into list_publish in one transaction */
export async function publishList(db: DbOrTx, list: ListKey, userId: string | null) {
	return db.transaction(async (tx) => {
		const data = await snapshot(tx, list);
		const now = new Date();
		await tx
			.insert(listPublish)
			.values({ list, data, publishedAt: now, publishedBy: userId })
			.onConflictDoUpdate({
				target: listPublish.list,
				set: { data, publishedAt: now, publishedBy: userId }
			});
		await syncUsage(
			tx,
			'list_publish',
			list,
			snapshotMedia(list, data).map((mediaId, i) => ({ field: `${list}.${i}`, mediaId }))
		);
		return data;
	});
}

/** Public site: the published snapshot, or the working copy in preview */
export async function readList<K extends ListKey>(
	db: DbOrTx,
	list: K,
	opts: { preview?: boolean } = {}
): Promise<ListSnapshots[K]> {
	if (opts.preview) return snapshot(db, list);
	const [row] = await db.select().from(listPublish).where(eq(listPublish.list, list));
	return (row?.data as ListSnapshots[K] | undefined) ?? EMPTY[list];
}

/** Media ids a list shows (to load them in one query) */
export function listMediaIds(list: ListKey, data: unknown) {
	return snapshotMedia(list, data);
}
