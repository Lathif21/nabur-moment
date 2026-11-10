// Business profile + bank account (P3-03, 02-DATA-MODEL app_settings): one row, read by the
// invoice / kwitansi PDFs and edited in Pengaturan → Bisnis & Keuangan. Not public content, so no
// draft / publish. Relative imports only.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { appSettings } from '../db/schema/index.ts';
import type { AppSettingsInput } from '../../schemas/finance.ts';
import { PRIVATE_BUCKET, type FileStorage } from '../storage/files.ts';
import { ServiceError } from './errors.ts';

export type AppSettings = {
	businessName: string;
	address: string | null;
	phone: string | null;
	email: string | null;
	instagram: string | null;
	bankName: string;
	bankNumber: string | null;
	bankHolder: string | null;
	/** Signature PNG in the private bucket (owner only) */
	signatureKey: string | null;
	signerName: string | null;
	signerTitle: string | null;
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
	signatureKey: null,
	signerName: null,
	signerTitle: null,
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
		signatureKey: row.signatureKey,
		signerName: row.signerName,
		signerTitle: row.signerTitle,
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

// ---------- signature (ttd) on invoices and kwitansi: owner only ----------

/** The browser trims the picture and makes its background transparent; this caps the file */
export const SIGNATURE_MAX_BYTES = 1024 * 1024;
const SIGNATURE_KEY = /^settings\/signature-[0-9a-f]{8}\.png$/;

/** What the PDFs print in the signature block */
export type PdfSigner = { image: string | null; name: string | null; title: string | null };

const upsert = (db: DbOrTx, set: Partial<typeof appSettings.$inferInsert>, userId: string | null) =>
	db
		.insert(appSettings)
		.values({ id: 1, ...set, updatedBy: userId })
		.onConflictDoUpdate({ target: appSettings.id, set: { ...set, updatedBy: userId } });

/** Step 1: a presigned PUT for the PNG; a new key each time so an old copy never lingers */
export async function createSignatureUpload(storage: FileStorage) {
	const key = `settings/signature-${randomUUID().slice(0, 8)}.png`;
	return { key, ...(await storage.uploadUrl(PRIVATE_BUCKET, key, 'image/png')) };
}

/** Step 2: the file is in the bucket → it becomes the signature; the previous file is removed */
export async function setSignature(
	db: DbOrTx,
	storage: FileStorage,
	key: string,
	userId: string | null
) {
	if (!SIGNATURE_KEY.test(key)) throw new ServiceError('Tanda tangan tidak valid.');
	const bytes = await storage.size(PRIVATE_BUCKET, key);
	if (bytes === null) throw new ServiceError('Unggahan belum lengkap. Coba unggah ulang.');
	if (bytes > SIGNATURE_MAX_BYTES) {
		await storage.remove(PRIVATE_BUCKET, [key]);
		throw new ServiceError('File tanda tangan terlalu besar (maksimal 1 MB).');
	}
	const old = (await readAppSettings(db)).signatureKey;
	await upsert(db, { signatureKey: key }, userId);
	if (old && old !== key) await removeQuietly(storage, old);
}

export async function removeSignature(db: DbOrTx, storage: FileStorage, userId: string | null) {
	const old = (await readAppSettings(db)).signatureKey;
	await upsert(db, { signatureKey: null }, userId);
	if (old) await removeQuietly(storage, old);
}

/** Name and title printed under the signature */
export async function saveSigner(
	db: DbOrTx,
	input: { signerName: string | null; signerTitle: string | null },
	userId: string | null
) {
	await upsert(db, input, userId);
}

async function removeQuietly(storage: FileStorage, key: string) {
	try {
		await storage.remove(PRIVATE_BUCKET, [key]);
	} catch (e) {
		console.warn(`signature: could not remove ${key}: ${String(e)}`);
	}
}

/**
 * The signer for a PDF: the PNG as a data URL (pdfmake embeds it) plus name and title. A missing
 * or unreadable file prints the empty signature line instead of failing the download.
 */
export async function pdfSigner(
	s: AppSettings,
	storage: Pick<FileStorage, 'downloadUrl'> | null
): Promise<PdfSigner> {
	let image: string | null = null;
	if (s.signatureKey && storage) {
		try {
			const res = await fetch(await storage.downloadUrl(s.signatureKey, 60));
			if (res.ok)
				image = `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
		} catch (e) {
			console.warn(`signature: could not read ${s.signatureKey}: ${String(e)}`);
		}
	}
	return { image, name: s.signerName, title: s.signerTitle };
}
