import { PUBLIC_SITE_URL } from '$app/env/private';
import { PAGES } from '#lib/cms/sections.ts';
import { db } from '#lib/server/db/index.ts';
import { readList } from '#lib/server/services/cms-lists.ts';
import type { RequestHandler } from './$types';

// Cached like the public pages; Terbitkan on Portofolio revalidates it (LIST_PATHS)
export const config = {
	isr: { expiration: 3600, bypassToken: process.env.ISR_BYPASS_TOKEN || undefined }
};

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** sitemap.xml: the CMS pages (not the thank-you page) and every published album */
export const GET: RequestHandler = async ({ url }) => {
	const origin = (PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');
	const albums = await readList(db, 'portfolio');
	const entries = [
		...PAGES.map((p) => ({ loc: `${origin}/${p.path}`, priority: p.path === '' ? '1.0' : '0.8' })),
		...albums.map((a) => ({ loc: `${origin}/portofolio/${a.slug}`, priority: '0.6' }))
	];
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `\t<url><loc>${esc(e.loc)}</loc><priority>${e.priority}</priority></url>`).join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
