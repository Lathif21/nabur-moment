import { requireOwner } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';

// Component gallery for design review (P0-04). Not in the sidebar; owner only; remove before
// launch (P4-02).
export const load: PageServerLoad = ({ locals }) => {
	requireOwner(locals);
};

export const actions: Actions = {
	demo: async ({ locals }) => {
		requireOwner(locals);
		return { done: 'Contoh aksi berhasil.' };
	}
};
