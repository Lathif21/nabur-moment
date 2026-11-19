// Test packages for specs that pick packages (booking drawer, /booking form). The dev branch may
// have none; these live in their own category and are removed again by `removeTestPackages`.
import { eq, inArray } from 'drizzle-orm';
import { createDb } from '../../../src/lib/server/db/client.ts';
import { packageCategory, pkg } from '../../../src/lib/server/db/schema/index.ts';
import { publishList } from '../../../src/lib/server/services/cms-lists.ts';

/** Category + two packages named `<label> A` / `<label> B`; `publish` also puts them on the site */
export async function addTestPackages(label: string, opts: { publish?: boolean } = {}) {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const [cat] = await db
			.insert(packageCategory)
			.values({ name: label, position: 'zz' })
			.returning({ id: packageCategory.id });
		const packages = await db
			.insert(pkg)
			.values([
				{ categoryId: cat.id, name: `${label} A`, price: 4_000_000, position: 'a0' },
				{ categoryId: cat.id, name: `${label} B`, price: 2_500_000, position: 'a1' }
			])
			.returning({ id: pkg.id, name: pkg.name, price: pkg.price });
		if (opts.publish) await publishList(db, 'packages', null);
		return { categoryId: cat.id, packages };
	} finally {
		await db.$client.end();
	}
}

export async function removeTestPackages(categoryId: string, opts: { publish?: boolean } = {}) {
	const db = createDb(process.env.DATABASE_URL!);
	try {
		const ids = (
			await db.select({ id: pkg.id }).from(pkg).where(eq(pkg.categoryId, categoryId))
		).map((p) => p.id);
		if (ids.length) await db.delete(pkg).where(inArray(pkg.id, ids));
		await db.delete(packageCategory).where(eq(packageCategory.id, categoryId));
		if (opts.publish) await publishList(db, 'packages', null);
	} finally {
		await db.$client.end();
	}
}
