// P4-01 helper: lists starter / placeholder content that is still PUBLISHED, so the owner knows what
// is left to replace before launch. Read-only: never writes.
// npm run content:audit                       (DATABASE_URL from .env = the dev branch)
// npm run content:audit -- --url "<conn>"     (any branch, e.g. production)
import { createDb } from '../src/lib/server/db/client.ts';
import type { PackagesSnapshot } from '../src/lib/cms/lists.ts';
import { PAGES, type Field } from '../src/lib/cms/sections.ts';
import { SITE_SETTINGS } from '../src/lib/cms/site-settings.ts';
import { readPage } from '../src/lib/server/services/cms-pages.ts';
import { readList } from '../src/lib/server/services/cms-lists.ts';
import { readSiteSettings } from '../src/lib/server/services/site-settings.ts';
import { readAppSettings } from '../src/lib/server/services/app-settings.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const i = process.argv.indexOf('--url');
const url = i > 0 ? process.argv[i + 1] : process.env.DATABASE_URL;
if (!url) {
	console.error('No DATABASE_URL: pass --url "<connection string>"');
	process.exit(1);
}

const isEmpty = (v: unknown) =>
	v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

/** Fields still holding the registry's starter text, and image fields left empty */
function check(fields: Field[], data: Record<string, unknown>, defaults: Record<string, unknown>) {
	const out: string[] = [];
	for (const f of fields) {
		const v = data[f.key];
		if (f.kind === 'image' || f.kind === 'media' || f.kind === 'images') {
			if (isEmpty(v)) out.push(`${f.label}: belum ada foto`);
		} else if (['text', 'textarea', 'richtext'].includes(f.kind)) {
			if (!isEmpty(v) && v === defaults[f.key]) out.push(`${f.label}: masih teks bawaan`);
		}
	}
	return out;
}

const db = createDb(url);
const findings: string[] = [];
const add = (where: string, items: string[]) => {
	for (const it of items) findings.push(`${where} — ${it}`);
};

try {
	for (const page of PAGES) {
		const sections = await readPage(db, page.key);
		for (const s of page.sections) {
			const sec = sections[s.key];
			if (!sec?.visible) continue;
			add(`Halaman ${page.label} › ${s.label}`, check(s.fields, sec.data, s.defaults));
		}
	}

	const site = await readSiteSettings(db);
	add(
		'Pengaturan › Situs',
		check(SITE_SETTINGS.fields, site as Record<string, unknown>, SITE_SETTINGS.defaults)
	);

	const app = await readAppSettings(db);
	const appMissing = [
		!app.address && 'alamat kosong',
		!app.phone && 'telepon kosong',
		!app.bankNumber && 'nomor rekening BCA kosong',
		!app.bankHolder && 'atas nama rekening kosong'
	].filter((x): x is string => !!x);
	add('Pengaturan › Bisnis & Keuangan', appMissing);

	const lists = {
		portfolio: 'Portofolio (album)',
		packages: 'Paket',
		testimonials: 'Testimoni',
		faq: 'FAQ'
	} as const;
	for (const [key, label] of Object.entries(lists) as [keyof typeof lists, string][]) {
		const snap = await readList(db, key);
		if (key === 'packages') {
			const { categories } = snap as PackagesSnapshot;
			if (!categories.some((c) => c.packages.length)) add(label, ['belum ada yang diterbitkan']);
		} else if (!(snap as unknown[]).length) add(label, ['belum ada yang diterbitkan']);
	}
} finally {
	await db.$client.end();
}

if (!findings.length) {
	console.log('Tidak ada konten bawaan yang masih tayang.');
} else {
	console.log(
		`${findings.length} hal masih bawaan / kosong (teks bawaan boleh dipertahankan bila sudah sesuai):\n`
	);
	for (const f of findings) console.log(`- ${f}`);
}
