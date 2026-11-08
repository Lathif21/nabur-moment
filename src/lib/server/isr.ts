// Vercel ISR bypass for admins: with this cookie the site's cached pages are skipped, so a
// logged-in admin always sees a fresh render (and drafts with ?preview=1). Never sent to visitors.
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import { ISR_BYPASS_TOKEN } from '$app/env/private';

export const ISR_BYPASS_COOKIE = '__prerender_bypass';

export function setIsrBypass(cookies: Cookies) {
	if (!ISR_BYPASS_TOKEN) return;
	cookies.set(ISR_BYPASS_COOKIE, ISR_BYPASS_TOKEN, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

export function clearIsrBypass(cookies: Cookies) {
	cookies.delete(ISR_BYPASS_COOKIE, { path: '/' });
}
