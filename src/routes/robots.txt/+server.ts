import { PUBLIC_SITE_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

/** robots.txt: everything public except the admin and APIs; points crawlers at the sitemap */
export const GET: RequestHandler = ({ url }) => {
	const origin = (PUBLIC_SITE_URL || url.origin).replace(/\/$/, '');
	const body = [
		'User-agent: *',
		'Disallow: /admin',
		'Disallow: /api/',
		'Disallow: /booking/terima-kasih',
		'',
		`Sitemap: ${origin}/sitemap.xml`,
		''
	].join('\n');
	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
};
