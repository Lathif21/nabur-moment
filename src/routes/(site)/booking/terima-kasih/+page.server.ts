import { loadPublicPage } from '#lib/server/site.ts';
import type { PageServerLoad } from './$types';

// Shown after the inquiry form (also for a filled honeypot); text from the CMS "thanks" section
export const load: PageServerLoad = async (event) => loadPublicPage(event, 'inquiry');
