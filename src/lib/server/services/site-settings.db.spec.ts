// P1-04: settings draft → Terbitkan → public; WhatsApp normalised; bad email refused.
// Runs on NEON_BRANCH=dev inside a transaction that is rolled back.
import { describe, expect, it } from 'vitest';
import { createDb, type Tx } from '../db/client';
import { ServiceError } from './errors';
import {
	getSiteSettingsForEdit,
	publishSiteSettings,
	readSiteSettings,
	revertSiteSettings,
	saveSiteSettingsDraft
} from './site-settings';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const isDevDb = !!url && process.env.NEON_BRANCH === 'dev';

class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>) {
	const db = createDb(url!);
	try {
		await db.transaction(async (tx) => {
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

describe.runIf(isDevDb)('site settings', () => {
	it('normalises WhatsApp, refuses a bad email, publishes on Terbitkan only', () =>
		inRollback(async (tx) => {
			const { draft } = await getSiteSettingsForEdit(tx);
			const before = await readSiteSettings(tx);

			const saved = await saveSiteSettingsDraft(
				tx,
				{ ...draft, whatsapp: '0812-3456-7890', footerText: 'Kalimat uji' },
				null
			);
			expect(saved.draft.whatsapp).toBe('6281234567890');
			await expect(
				saveSiteSettingsDraft(tx, { ...draft, email: 'bukan-email' }, null)
			).rejects.toBeInstanceOf(ServiceError);

			expect((await readSiteSettings(tx)).footerText).toBe(before.footerText);
			expect((await readSiteSettings(tx, { preview: true })).footerText).toBe('Kalimat uji');

			await publishSiteSettings(tx, null);
			expect(await readSiteSettings(tx)).toMatchObject({
				footerText: 'Kalimat uji',
				whatsapp: '6281234567890'
			});

			await saveSiteSettingsDraft(tx, { ...saved.draft, footerText: 'Batal' }, null);
			await revertSiteSettings(tx);
			expect((await readSiteSettings(tx, { preview: true })).footerText).toBe('Kalimat uji');
		}));
});
