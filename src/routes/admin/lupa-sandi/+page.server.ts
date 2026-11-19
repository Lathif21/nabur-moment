import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { APIError } from 'better-auth/api';
import { forgotPasswordSchema } from '#lib/schemas/access.ts';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, resolve('admin'));
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const parsed = forgotPasswordSchema.safeParse({ email });
		if (!parsed.success) return fail(400, { email, message: parsed.error.issues[0].message });

		try {
			// Same answer whether or not the email exists, so the form reveals no accounts
			await auth.api.requestPasswordReset({
				body: { email: parsed.data.email },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError && e.status === 'TOO_MANY_REQUESTS') {
				return fail(429, {
					email,
					message: 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
				});
			}
			console.error('Password reset email failed', e);
			return fail(500, {
				email,
				message: 'Email belum bisa dikirim. Coba lagi nanti atau hubungi pemilik akun.'
			});
		}
		return { sent: true, email };
	}
};
