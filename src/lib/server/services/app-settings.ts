// Business profile + bank account (P3-03, 02-DATA-MODEL app_settings): one row, read by the
// invoice / kwitansi PDFs and edited in Pengaturan → Bisnis & Keuangan. Not public content, so no
// draft / publish. Relative imports only.
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { appSettings } from '../db/schema/index.ts';
import type { AppSettingsInput } from '../../schemas/finance.ts';

export type AppSettings = {
	businessName: string;
	address: string | null;
	phone: string | null;
	email: string | null;
	instagram: string | null;
	bankName: string;
	bankNumber: string | null;
	bankHolder: string | null;
	updatedAt: Date | null;
};

const DEFAULTS: AppSettings = {
	businessName: 'Nabur Moment',
	address: null,
	phone: null,
	email: null,
	instagram: null,
	bankName: 'BCA',
	bankNumber: null,
	bankHolder: null,
	updatedAt: null
};

/** The settings row (defaults if 0011's seed row is missing) */
export async function readAppSettings(db: DbOrTx): Promise<AppSettings> {
	const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
	if (!row) return { ...DEFAULTS };
	return {
		businessName: row.businessName,
		address: row.address,
		phone: row.phone,
		email: row.email,
		instagram: row.instagram,
		bankName: row.bankName,
		bankNumber: row.bankNumber,
		bankHolder: row.bankHolder,
		updatedAt: row.updatedAt
	};
}

export async function saveAppSettings(
	db: DbOrTx,
	input: AppSettingsInput,
	userId: string | null
): Promise<AppSettings> {
	await db
		.insert(appSettings)
		.values({ id: 1, ...input, updatedBy: userId })
		.onConflictDoUpdate({ target: appSettings.id, set: { ...input, updatedBy: userId } });
	return readAppSettings(db);
}

/** The invoice cannot tell clients where to pay until both are filled in */
export const bankReady = (s: AppSettings) => !!(s.bankNumber && s.bankHolder);
