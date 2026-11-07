import { loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Shown after the inquiry form (also for a filled honeypot); text from the CMS "thanks" section
export const load: PageServerLoad = async (event) => {
	const page = await loadPublicPage(event, 'inquiry');
	return { ...page, meta: { ...page.meta, title: 'Terima kasih', noindex: true } };
};
