// Public pages are cached on Vercel (ISR). After Terbitkan the refreshed page reaches every edge
// within a few seconds, so a visitor check right after publishing reloads until it sees the new
// content. Locally (no ISR) the first load already passes.
import { expect, type Page, type Response } from '@playwright/test';

export async function gotoFresh(
	page: Page,
	path: string,
	check: (response: Response | null) => Promise<void>,
	timeout = 30_000
) {
	await expect(async () => {
		const response = await page.goto(path);
		await check(response);
	}).toPass({ timeout, intervals: [1_000, 2_000, 3_000] });
}

/**
 * Specs that publish through services (not the admin UI) skip the app's own revalidation; on a
 * deployed target, refresh those paths the same way Terbitkan does. No-op locally.
 */
export async function revalidateRemote(paths: string[]) {
	const base = process.env.E2E_BASE_URL;
	const token = process.env.ISR_BYPASS_TOKEN;
	if (!base || /^http:\/\/(localhost|127\.0\.0\.1)/.test(base) || !token) return;
	const headers: Record<string, string> = { 'x-prerender-revalidate': token };
	const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
	if (bypass) headers['x-vercel-protection-bypass'] = bypass;
	await Promise.all(paths.map((p) => fetch(new URL('/' + p, base), { method: 'HEAD', headers })));
}
