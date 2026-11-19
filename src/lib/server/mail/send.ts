// Outgoing email through the Resend REST API (no SDK). Used for password reset links only.
import { dev } from '$app/env';
import { EMAIL_FROM, RESEND_API_KEY } from '$app/env/private';

export type Mail = { to: string; subject: string; html: string; text: string };

export async function sendMail(mail: Mail) {
	if (!RESEND_API_KEY || !EMAIL_FROM) {
		// Local dev without a key: print the mail so the link can still be followed
		if (dev) {
			console.info(`[mail] RESEND_API_KEY not set, not sent:\n${mail.subject}\n${mail.text}`);
			return;
		}
		throw new Error('RESEND_API_KEY / EMAIL_FROM not set: email cannot be sent');
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...mail, from: EMAIL_FROM, to: [mail.to] })
	});
	if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
