// Refreshes cached public pages after Terbitkan (docs/04-ARCHITECTURE.md → Caching public pages).
// A request carrying the bypass token in `x-prerender-revalidate` rebuilds the cached page on
// Vercel. Production targets PUBLIC_SITE_URL; a preview deploy (no PUBLIC_SITE_URL) targets its own
// URL and passes Vercel's deployment protection with the automation bypass secret. Locally (no
// ISR) this is a no-op.
import {
	ISR_BYPASS_TOKEN,
	PUBLIC_SITE_URL,
	VERCEL_AUTOMATION_BYPASS_SECRET,
	VERCEL_URL
} from '$app/env/private';

export async function revalidate(paths: string[]) {
	const token = ISR_BYPASS_TOKEN;
	const site = PUBLIC_SITE_URL || (VERCEL_URL ? `https://${VERCEL_URL}` : '');
	if (!token || !site) return;
	const headers: Record<string, string> = { 'x-prerender-revalidate': token };
	if (!PUBLIC_SITE_URL && VERCEL_AUTOMATION_BYPASS_SECRET)
		headers['x-vercel-protection-bypass'] = VERCEL_AUTOMATION_BYPASS_SECRET;
	await Promise.allSettled(
		paths.map((p) => fetch(new URL('/' + p, site), { method: 'HEAD', headers }))
	);
}
