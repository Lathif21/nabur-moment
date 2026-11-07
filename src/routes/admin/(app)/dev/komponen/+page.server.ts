import type { Actions } from './$types';

// Component gallery for design review (P0-04). Not in the sidebar; remove before launch (P4-02).
export const actions: Actions = {
	demo: async () => ({ done: 'Contoh aksi berhasil.' })
};
