// Pengaturan → Situs: draft + Terbitkan like CMS pages. Relative imports only.
import { eq } from 'drizzle-orm';
import { mediaRefs, sectionSchema } from '../../cms/sections.ts';
import { SITE_SETTINGS, type SiteSettings } from '../../cms/site-settings.ts';
import { phoneNormalize } from '../../format.ts';
import type { DbOrTx } from '../db/client.ts';
import { siteSettings } from '../db/schema/index.ts';
import { cleanSection } from './cms-pages.ts';
import { ServiceError } from './errors.ts';
import { syncUsage } from './media.ts';

const ROW = 1;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function ensureRow(db: DbOrTx) {
	await db
		.insert(siteSettings)
		.values({
			id: ROW,
			draft: SITE_SETTINGS.defaults,
			published: SITE_SETTINGS.defaults,
			publishedAt: new Date()
		})
		.onConflictDoNothing();
}

/** Validation + normalisation: WhatsApp stored as 628…, email shape checked */
export function cleanSiteSettings(input: unknown) {
	const data = cleanSection(SITE_SETTINGS, input);
	const wa = String(data.whatsapp ?? '').trim();
	if (wa) {
		const n = phoneNormalize(wa);
		if (!n || n.length < 10) throw new ServiceError('Nomor WhatsApp tidak valid.');
		data.whatsapp = n;
	}
	const email = String(data.email ?? '').trim();
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		throw new ServiceError('Email tidak valid.');
	return data;
}

async function rebuildUsage(
	db: DbOrTx,
	draft: Record<string, unknown>,
	published: Record<string, unknown> | null
) {
	await syncUsage(db, 'site_settings', 'site', [
		...mediaRefs(SITE_SETTINGS, draft),
		...(published ? mediaRefs(SITE_SETTINGS, published) : [])
	]);
}

export async function getSiteSettingsForEdit(db: DbOrTx) {
	await ensureRow(db);
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, ROW));
	const draft = sectionSchema(SITE_SETTINGS).safeParse(row.draft);
	return {
		draft: (draft.success ? draft.data : SITE_SETTINGS.defaults) as Record<string, unknown>,
		dirty: !same(row.draft, row.published),
		publishedAt: row.publishedAt
	};
}

export async function saveSiteSettingsDraft(db: DbOrTx, input: unknown, userId: string | null) {
	const draft = cleanSiteSettings(input);
	await ensureRow(db);
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(siteSettings)
			.set({ draft, updatedAt: new Date(), updatedBy: userId })
			.where(eq(siteSettings.id, ROW))
			.returning();
		await rebuildUsage(tx, draft, row.published);
		return { draft, dirty: !same(row.draft, row.published) };
	});
}

export async function publishSiteSettings(db: DbOrTx, userId: string | null) {
	await ensureRow(db);
	return db.transaction(async (tx) => {
		const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.id, ROW));
		const content = cleanSiteSettings(row.draft);
		await tx
			.update(siteSettings)
			.set({ draft: content, published: content, publishedAt: new Date(), updatedBy: userId })
			.where(eq(siteSettings.id, ROW));
		await rebuildUsage(tx, content, content);
	});
}

export async function revertSiteSettings(db: DbOrTx) {
	await ensureRow(db);
	return db.transaction(async (tx) => {
		const [row] = await tx.select().from(siteSettings).where(eq(siteSettings.id, ROW));
		const published = row.published ?? SITE_SETTINGS.defaults;
		await tx.update(siteSettings).set({ draft: published }).where(eq(siteSettings.id, ROW));
		await rebuildUsage(tx, published, row.published);
	});
}

/** Public layout: published settings (draft in preview); defaults when nothing is stored yet */
export async function readSiteSettings(
	db: DbOrTx,
	opts: { preview?: boolean } = {}
): Promise<SiteSettings> {
	const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, ROW));
	const raw = opts.preview ? row?.draft : row?.published;
	const parsed = sectionSchema(SITE_SETTINGS).safeParse(raw ?? SITE_SETTINGS.defaults);
	return (parsed.success ? parsed.data : SITE_SETTINGS.defaults) as SiteSettings;
}
