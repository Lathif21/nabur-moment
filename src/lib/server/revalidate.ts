// Refreshes cached public pages after Terbitkan (docs/04-ARCHITECTURE.md → Caching public pages).
// A request carrying the bypass token in `x-prerender-revalidate` rebuilds the cached page on
// Vercel. The cache is kept per hostname, so the request must go to the host visitors use:
// production → PUBLIC_SITE_URL; a preview deploy (no PUBLIC_SITE_URL) → its git branch URL and its
// own URL, through deployment protection with the automation bypass secret. Locally (no ISR) this
// is a no-op.
import {
	ISR_BYPASS_TOKEN,
	PUBLIC_SITE_URL,
	VERCEL_AUTOMATION_BYPASS_SECRET,
	VERCEL_BRANCH_URL,
	VERCEL_URL
} from '$app/env/private';

export async function revalidate(paths: string[]) {
	const token = ISR_BYPASS_TOKEN;
	const hosts = PUBLIC_SITE_URL
		? [PUBLIC_SITE_URL]
		: [VERCEL_BRANCH_URL, VERCEL_URL].filter((h): h is string => !!h).map((h) => `https://${h}`);
	if (!token || !hosts.length) return;
	const headers: Record<string, string> = { 'x-prerender-revalidate': token };
	if (!PUBLIC_SITE_URL && VERCEL_AUTOMATION_BYPASS_SECRET)
		headers['x-vercel-protection-bypass'] = VERCEL_AUTOMATION_BYPASS_SECRET;
	const targets = hosts.flatMap((h) => paths.map((p) => new URL('/' + p, h)));
	const results = await Promise.allSettled(
		targets.map((url) => fetch(url, { method: 'HEAD', headers, redirect: 'manual' }))
	);
	// Publishing still succeeds; the hourly expiry is the backstop. Logged for Vercel's runtime logs.
	// (Uncached pages such as /booking answer MISS, which is fine.)
	results.forEach((r, i) => {
		if (r.status === 'rejected') console.warn(`revalidate ${targets[i]}: ${String(r.reason)}`);
		else if (r.value.status >= 300)
			console.warn(`revalidate ${targets[i]}: HTTP ${r.value.status}`);
	});
}
