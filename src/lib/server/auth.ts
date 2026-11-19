import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '$app/env/private';
import { resolve } from '$app/paths';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { db } from '#lib/server/db/index.ts';
import { createAuth } from './auth-config.ts';
import { resetPasswordMail } from './mail/reset-password.ts';
import { sendMail } from './mail/send.ts';

export const auth = createAuth(db, {
	baseURL: BETTER_AUTH_URL,
	secret: BETTER_AUTH_SECRET,
	// "Lupa kata sandi?": the emailed link opens /admin/reset-sandi?token=…
	sendResetPassword: async ({ user, token }) => {
		const link = new URL(resolve('admin/reset-sandi'), BETTER_AUTH_URL);
		link.searchParams.set('token', token);
		await sendMail(resetPasswordMail(user, link.href));
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // must stay the last plugin
	]
});

export type { AuthSession, AuthUser } from './auth-config.ts';
