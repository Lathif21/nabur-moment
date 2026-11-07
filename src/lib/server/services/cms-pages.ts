// CMS pages (docs/04-ARCHITECTURE.md → CMS content flow). Draft is autosaved, Terbitkan copies the
// whole page draft → published in one transaction. Relative imports only.
import { and, asc, eq, inArray } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';
import {
	type Field,
	getSection,
	mediaRefs,
	PAGE_BY_KEY,
	type PageKey,
	PAGES,
	sectionSchema,
	type SectionDef
} from '../../cms/sections.ts';
import type { DbOrTx } from '../db/client.ts';
import { media, pageSection } from '../db/schema/index.ts';
import { ServiceError } from './errors.ts';
import { syncUsage } from './media.ts';

const OWNER = 'page_section';
const ownerId = (page: string, key: string) => `${page}:${key}`;

/* ---------- Rich text ---------- */

/** The only markup a rich text field may keep: paragraphs, line breaks, bold, italic, links */
export function sanitizeRichText(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'a'],
		allowedAttributes: { a: ['href', 'target', 'rel'] },
		allowedSchemes: ['https', 'mailto', 'tel'],
		allowedSchemesAppliedToAttributes: ['href'],
		allowProtocolRelative: false,
		transformTags: {
			b: 'strong',
			i: 'em',
			// External links open in a new tab, safely
			a: (tagName, attribs) => {
				const href = attribs.href ?? '';
				const out: Record<string, string> = { href };
				if (/^https:\/\//.test(href)) {
					out.target = '_blank';
					out.rel = 'noopener noreferrer';
				}
				return { tagName, attribs: out };
			}
		}
	}).trim();
}

function sanitizeFields(fields: Field[], data: Record<string, unknown>) {
	for (const f of fields) {
		const v = data[f.key];
		if (f.kind === 'richtext' && typeof v === 'string') data[f.key] = sanitizeRichText(v);
		if (f.kind === 'list' && Array.isArray(v))
			for (const item of v) sanitizeFields(f.fields, item as Record<string, unknown>);
	}
	return data;
}

/** Validates against the registry schema and cleans rich text */
export function cleanSection(def: SectionDef, input: unknown): Record<string, unknown> {
	const parsed = sectionSchema(def).safeParse(input ?? {});
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const field = def.fields.find((f) => f.key === issue.path[0]);
		throw new ServiceError(
			`${def.label} → ${field?.label ?? issue.path.join('.')}: ${issue.message}`
		);
	}
	return sanitizeFields(def.fields, parsed.data as Record<string, unknown>);
}

/* ---------- Rows ---------- */

/** Creates missing rows from the registry (idempotent). Defaults start out published. */
export async function ensureSections(db: DbOrTx, page?: PageKey) {
	const pages = page ? [PAGE_BY_KEY.get(page)!] : PAGES;
	const rows = pages.flatMap((p) =>
		p.sections.map((s, i) => ({
			page: p.key,
			key: s.key,
			sort: i,
			draft: s.defaults,
			published: s.defaults,
			publishedAt: new Date()
		}))
	);
	await db.insert(pageSection).values(rows).onConflictDoNothing();
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Pages list: has any section a change not yet published? */
export async function listPages(db: DbOrTx) {
	await ensureSections(db);
	const rows = await db.select().from(pageSection);
	return PAGES.map((p) => {
		const mine = rows.filter((r) => r.page === p.key);
		const dirty = mine.some((r) => !same(r.draft, r.published) || r.draftVisible !== r.visible);
		const publishedAt = mine
			.map((r) => r.publishedAt?.getTime() ?? 0)
			.reduce((a, b) => Math.max(a, b), 0);
		return {
			key: p.key,
			label: p.label,
			path: p.path,
			sections: p.sections.length,
			dirty,
			publishedAt: publishedAt ? new Date(publishedAt) : null
		};
	});
}

/** Editor: every section of a page with its draft (filled with defaults for new fields) */
export async function getPageForEdit(db: DbOrTx, page: PageKey) {
	await ensureSections(db, page);
	const def = PAGE_BY_KEY.get(page)!;
	const rows = await db
		.select()
		.from(pageSection)
		.where(eq(pageSection.page, page))
		.orderBy(asc(pageSection.sort));
	return def.sections.map((s) => {
		const row = rows.find((r) => r.key === s.key)!;
		const draft = sectionSchema(s).safeParse(row.draft);
		return {
			key: s.key,
			draft: (draft.success ? draft.data : s.defaults) as Record<string, unknown>,
			draftVisible: row.draftVisible,
			dirty: !same(row.draft, row.published) || row.draftVisible !== row.visible,
			publishedAt: row.publishedAt
		};
	});
}

/** Usage covers draft and published, so an image still live on the site cannot be deleted */
async function rebuildUsage(
	db: DbOrTx,
	def: SectionDef,
	page: string,
	draft: Record<string, unknown>,
	published: Record<string, unknown> | null
) {
	const refs = [...mediaRefs(def, draft), ...(published ? mediaRefs(def, published) : [])];
	await syncUsage(db, OWNER, ownerId(page, def.key), refs);
}

/** Autosave of one section */
export async function saveSectionDraft(
	db: DbOrTx,
	page: PageKey,
	key: string,
	input: { data: unknown; visible: boolean },
	userId: string | null
) {
	const def = getSection(page, key);
	if (!def) throw new ServiceError('Bagian halaman tidak ditemukan.');
	const draft = cleanSection(def, input.data);
	await ensureSections(db, page);
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(pageSection)
			.set({ draft, draftVisible: input.visible, updatedAt: new Date(), updatedBy: userId })
			.where(and(eq(pageSection.page, page), eq(pageSection.key, key)))
			.returning();
		await rebuildUsage(tx, def, page, draft, row.published);
		return {
			draft,
			dirty: !same(row.draft, row.published) || row.draftVisible !== row.visible
		};
	});
}

/** Images used on a published page need alt text (06-DESIGN-SYSTEM → Accessibility) */
async function assertAltText(db: DbOrTx, def: SectionDef, data: Record<string, unknown>) {
	const ids = [...new Set(mediaRefs(def, data).map((r) => r.mediaId))];
	if (!ids.length) return;
	const rows = await db
		.select({ id: media.id, kind: media.kind, alt: media.alt, filename: media.filename })
		.from(media)
		.where(inArray(media.id, ids));
	if (rows.length !== ids.length)
		throw new ServiceError(`${def.label}: ada media yang sudah dihapus. Pilih ulang.`);
	const missing = rows.filter((m) => m.kind === 'image' && !m.alt.trim());
	if (missing.length)
		throw new ServiceError(
			`${def.label}: isi teks alternatif (alt) dulu untuk ${missing
				.map((m) => m.filename ?? 'gambar')
				.join(', ')} di Konten → Media.`
		);
}

/** Terbitkan: every section of the page, draft → published, in one transaction */
export async function publishPage(db: DbOrTx, page: PageKey, userId: string | null) {
	const def = PAGE_BY_KEY.get(page);
	if (!def) throw new ServiceError('Halaman tidak ditemukan.');
	await ensureSections(db, page);
	return db.transaction(async (tx) => {
		const rows = await tx.select().from(pageSection).where(eq(pageSection.page, page));
		const now = new Date();
		for (const s of def.sections) {
			const row = rows.find((r) => r.key === s.key)!;
			const content = cleanSection(s, row.draft);
			if (row.draftVisible) await assertAltText(tx, s, content);
			await tx
				.update(pageSection)
				.set({
					draft: content,
					published: content,
					visible: row.draftVisible,
					publishedAt: now,
					updatedBy: userId
				})
				.where(eq(pageSection.id, row.id));
			await rebuildUsage(tx, s, page, content, content);
		}
		return { path: def.path, publishedAt: now };
	});
}

/** Kembalikan ke versi terbit: drop unpublished edits */
export async function revertPage(db: DbOrTx, page: PageKey) {
	const def = PAGE_BY_KEY.get(page);
	if (!def) throw new ServiceError('Halaman tidak ditemukan.');
	await ensureSections(db, page);
	return db.transaction(async (tx) => {
		const rows = await tx.select().from(pageSection).where(eq(pageSection.page, page));
		for (const s of def.sections) {
			const row = rows.find((r) => r.key === s.key)!;
			const published = row.published ?? s.defaults;
			await tx
				.update(pageSection)
				.set({ draft: published, draftVisible: row.visible })
				.where(eq(pageSection.id, row.id));
			await rebuildUsage(tx, s, page, published, row.published);
		}
	});
}

export type PublicSection = { visible: boolean; data: Record<string, unknown> };

/**
 * What a public route shows: published content, or the draft in preview. Missing rows and new
 * fields fall back to the registry defaults, so a page always renders.
 */
export async function readPage(
	db: DbOrTx,
	page: PageKey,
	opts: { preview?: boolean } = {}
): Promise<Record<string, PublicSection>> {
	const def = PAGE_BY_KEY.get(page)!;
	const rows = await db.select().from(pageSection).where(eq(pageSection.page, page));
	const out: Record<string, PublicSection> = {};
	for (const s of def.sections) {
		const row = rows.find((r) => r.key === s.key);
		const raw = opts.preview ? row?.draft : row?.published;
		const parsed = sectionSchema(s).safeParse(raw ?? s.defaults);
		out[s.key] = {
			visible: row ? (opts.preview ? row.draftVisible : row.visible) : true,
			data: (parsed.success ? parsed.data : s.defaults) as Record<string, unknown>
		};
	}
	return out;
}

/** Every media id a page's content refers to (to load them in one query) */
export function pageMediaIds(
	page: PageKey,
	sections: Record<string, { data: Record<string, unknown> }>
) {
	const def = PAGE_BY_KEY.get(page)!;
	return [
		...new Set(
			def.sections.flatMap((s) =>
				sections[s.key] ? mediaRefs(s, sections[s.key].data).map((r) => r.mediaId) : []
			)
		)
	];
}
