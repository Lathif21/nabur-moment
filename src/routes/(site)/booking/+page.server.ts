import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { inquirySchema } from '#lib/schemas/inquiry.ts';
import { db } from '#lib/server/db/index.ts';
import { listLeadSources } from '#lib/server/services/clients.ts';
import { submitInquiry } from '#lib/server/services/inquiries.ts';
import { loadPublicList, loadPublicPage } from '#lib/server/site.ts';
import type { Actions, PageServerLoad } from './$types';

// Not cached (ISR off): on Vercel an ISR function turns the action's fail(400) into a generic
// "Bad request", so visitors would never see which field to fix. The page is cheap to render.
export const config = { isr: false };

// Booking / inquiry (03-SCREENS A6): intro from the CMS, packages from the published list,
// lead sources for "Tahu kami dari mana". ?paket=<id> preselects a package in the browser.
export const load: PageServerLoad = async (event) => {
	const [page, packages, sources] = await Promise.all([
		loadPublicPage(event, 'inquiry'),
		loadPublicList(event, 'packages'),
		listLeadSources(db)
	]);
	return {
		...page,
		packages: packages.data.categories.flatMap((c) =>
			c.packages.map((p) => ({ id: p.id, name: p.name, category: c.name }))
		),
		sources: sources.map((s) => ({ id: s.id, name: s.name }))
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const raw = formObject(await request.formData());
		// Honeypot filled: act as if it worked, save nothing
		if (typeof raw.website === 'string' && raw.website.trim()) {
			redirect(303, resolve('booking/terima-kasih'));
		}
		const parsed = inquirySchema.safeParse(raw);
		if (!parsed.success) {
			// Echo what was typed (never the honeypot) so the form keeps it
			const values = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'website'));
			return fail(400, { fields: fieldErrors(parsed.error.issues), values });
		}
		await submitInquiry(db, parsed.data);
		redirect(303, resolve('booking/terima-kasih'));
	}
};
