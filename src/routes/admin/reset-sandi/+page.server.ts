import { fail, redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { APIError } from 'better-auth/api';
import { fieldErrors, newPasswordSchema } from '#lib/schemas/access.ts';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { isResetTokenValid } from '#lib/server/services/users.ts';
import type { Actions, PageServerLoad } from './$types';

const INVALID = 'Tautan ini tidak valid atau sudah kedaluwarsa. Minta tautan baru.';

// The link from the "Lupa kata sandi" email: /admin/reset-sandi?token=…
export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { token, valid: await isResetTokenValid(db, token) };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const parsed = newPasswordSchema.safeParse({
			token: form.get('token') ?? '',
			password: form.get('password') ?? '',
			confirm: form.get('confirm') ?? ''
		});
		if (!parsed.success) {
			const errors = fieldErrors(parsed.error.issues);
			return errors.token ? fail(400, { message: INVALID }) : fail(400, { errors });
		}

		try {
			// Single-use token; every session of this user is signed out (revokeSessionsOnPasswordReset)
			await auth.api.resetPassword({
				body: { token: parsed.data.token, newPassword: parsed.data.password },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError) {
				const message =
					e.status === 'TOO_MANY_REQUESTS'
						? 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
						: INVALID;
				return fail(400, { message });
			}
			throw e;
		}
		redirect(303, `${resolve('admin/login')}?reset=1`);
	}
};
