// Refreshes cached public pages after Terbitkan (docs/04-ARCHITECTURE.md → Caching public pages).
// ISR is switched on for public routes in P1-06; until then pages render per request and this is
// a no-op. With ISR, a request carrying the bypass token in `x-prerender-revalidate` rebuilds the
// cached page on Vercel.
import { ISR_BYPASS_TOKEN, PUBLIC_SITE_URL } from '$app/env/private';

export async function revalidate(paths: string[]) {
	const token = ISR_BYPASS_TOKEN;
	const site = PUBLIC_SITE_URL;
	if (!token || !site) return;
	await Promise.allSettled(
		paths.map((p) =>
			fetch(new URL('/' + p, site), {
				method: 'HEAD',
				headers: { 'x-prerender-revalidate': token }
			})
		)
	);
}
