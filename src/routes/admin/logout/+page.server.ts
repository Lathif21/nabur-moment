import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Logout is POST-only (a form in the sidebar); a GET just goes to the dashboard
export const load: PageServerLoad = () => {
	redirect(303, resolve('admin'));
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (locals.session) await auth.api.signOut({ headers: request.headers });
		redirect(303, resolve('admin/login'));
	}
};
