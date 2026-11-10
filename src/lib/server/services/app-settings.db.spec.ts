// Signature (ttd) on the dev bucket: upload, replace (old file removed), read for a PDF, remove.
// Runs only on NEON_BRANCH=dev with storage credentials. The settings row change is rolled back;
// the spec starts from "no signature" inside its transaction, so it never deletes a real file.
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, type Tx } from '../db/client';
import { appSettings } from '../db/schema/index';
import { neonStorage, PRIVATE_BUCKET, storageConfig } from '../storage/files';
import {
	createSignatureUpload,
	pdfSigner,
	readAppSettings,
	removeSignature,
	saveSigner,
	setSignature
} from './app-settings';
import { ServiceError } from './errors';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const config = storageConfig(process.env);
const ready = !!url && !!config && process.env.NEON_BRANCH === 'dev';

/** 1×1 transparent PNG */
const PNG = Uint8Array.from(
	atob(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
	),
	(c) => c.charCodeAt(0)
);

class Rollback extends Error {}

describe.runIf(ready)('signature on the dev bucket', () => {
	const storage = neonStorage(config!);
	const made: string[] = [];

	afterAll(async () => {
		await storage.remove(PRIVATE_BUCKET, made).catch(() => {});
	});

	async function upload(tx: Tx) {
		const t = await createSignatureUpload(storage);
		made.push(t.key);
		expect(t.key).toMatch(/^settings\/signature-[0-9a-f]{8}\.png$/);
		// Not usable before the file is there
		await expect(setSignature(tx, storage, t.key, null)).rejects.toBeInstanceOf(ServiceError);
		const res = await fetch(t.url, { method: 'PUT', body: PNG, headers: t.headers });
		expect(res.status).toBe(200);
		await setSignature(tx, storage, t.key, null);
		return t.key;
	}

	it('uploads, replaces, prints and removes the signature', async () => {
		const db = createDb(url!);
		try {
			await db.transaction(async (tx) => {
				await tx.update(appSettings).set({ signatureKey: null });

				const first = await upload(tx);
				const second = await upload(tx);
				expect((await readAppSettings(tx)).signatureKey).toBe(second);
				// Replacing removes the previous file
				expect(await storage.size(PRIVATE_BUCKET, first)).toBeNull();

				await saveSigner(tx, { signerName: 'Lathif', signerTitle: 'Owner' }, null);
				const s = await readAppSettings(tx);
				const signer = await pdfSigner(s, storage);
				expect(signer).toMatchObject({ name: 'Lathif', title: 'Owner' });
				expect(signer.image).toMatch(/^data:image\/png;base64,iVBOR/);

				// Keys outside settings/ are refused
				await expect(
					setSignature(tx, storage, 'media/x/cover-00000000.webp', null)
				).rejects.toBeInstanceOf(ServiceError);

				await removeSignature(tx, storage, null);
				expect((await readAppSettings(tx)).signatureKey).toBeNull();
				expect(await storage.size(PRIVATE_BUCKET, second)).toBeNull();
				// No signature (or no storage): the PDF keeps the empty line
				expect((await pdfSigner(await readAppSettings(tx), storage)).image).toBeNull();
				throw new Rollback();
			});
		} catch (e) {
			if (!(e instanceof Rollback)) throw e;
		} finally {
			await db.$client.end();
		}
	});
});
