// "Atur ulang kata sandi" email. Pure (no env), so it can be unit-tested; the caller builds the link.
// Email clients ignore CSS variables, so the 06-DESIGN-SYSTEM.md token values are inlined here.
import type { Mail } from './send.ts';

const FOREST = '#113231';
const CREAM = '#FBF6EA';
const INK_2 = '#4D5E5A';

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetPasswordMail(to: { email: string; name: string }, link: string): Mail {
	const name = to.name.trim() || to.email;
	const safeName = escapeHtml(name);
	const safeLink = escapeHtml(link);
	return {
		to: to.email,
		subject: 'Atur ulang kata sandi · Nabur Moment',
		text: [
			`Halo ${name},`,
			'',
			'Kami menerima permintaan untuk mengatur ulang kata sandi akun admin Nabur Moment Anda.',
			'Buka tautan berikut untuk membuat kata sandi baru (berlaku 1 jam):',
			link,
			'',
			'Jika Anda tidak meminta ini, abaikan email ini. Kata sandi Anda tidak berubah.'
		].join('\n'),
		html: `<!doctype html>
<html lang="id">
<body style="margin:0;background:${CREAM};font-family:Arial,Helvetica,sans-serif;color:${FOREST}">
<div style="max-width:480px;margin:0 auto;padding:32px 24px">
<p style="font-size:13px;letter-spacing:4px;font-weight:bold;margin:0 0 24px">NABUR MOMENT</p>
<p style="font-size:15px;line-height:1.6">Halo ${safeName},</p>
<p style="font-size:15px;line-height:1.6">Kami menerima permintaan untuk mengatur ulang kata sandi akun admin Nabur Moment Anda. Tautan ini berlaku 1 jam.</p>
<p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;background:${FOREST};color:${CREAM};text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:8px">Buat kata sandi baru</a></p>
<p style="font-size:13px;line-height:1.6;color:${INK_2}">Jika tombol tidak berfungsi, salin tautan ini ke browser:<br><a href="${safeLink}" style="color:${FOREST};word-break:break-all">${safeLink}</a></p>
<p style="font-size:13px;line-height:1.6;color:${INK_2}">Jika Anda tidak meminta ini, abaikan email ini. Kata sandi Anda tidak berubah.</p>
</div>
</body>
</html>`
	};
}
