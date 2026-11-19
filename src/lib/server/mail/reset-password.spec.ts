import { describe, expect, it } from 'vitest';
import { resetPasswordMail } from './reset-password.ts';

describe('resetPasswordMail', () => {
	const link = 'https://naburmoment.com/admin/reset-sandi?token=abc&x=1';

	it('addresses the user and carries the link in both parts', () => {
		const mail = resetPasswordMail({ email: 'sari@contoh.id', name: 'Sari' }, link);
		expect(mail.to).toBe('sari@contoh.id');
		expect(mail.text).toContain('Halo Sari,');
		expect(mail.text).toContain(link);
		expect(mail.html).toContain(
			'href="https://naburmoment.com/admin/reset-sandi?token=abc&#38;x=1"'
		);
	});

	it('escapes the name in the HTML and falls back to the email', () => {
		const mail = resetPasswordMail({ email: 'a@b.id', name: '<b>X</b>' }, link);
		expect(mail.html).not.toContain('<b>X</b>');
		expect(mail.html).toContain('&#60;b&#62;X&#60;/b&#62;');
		expect(resetPasswordMail({ email: 'a@b.id', name: ' ' }, link).text).toContain('Halo a@b.id,');
	});
});
