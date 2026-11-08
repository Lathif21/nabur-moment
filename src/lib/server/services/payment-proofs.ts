// Payment proofs (P3-04): a transfer screenshot uploaded by the browser straight to the private
// bucket with a presigned PUT (never through a Vercel function), kept as a `media` row with
// bucket = private-files. Downloads go through a permission-checked route that redirects to a
// short presigned GET. Relative imports only.
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from '../db/client.ts';
import { media } from '../db/schema/index.ts';
import { PRIVATE_BUCKET, type FileStorage } from '../storage/files.ts';
import { PROOF_MAX_BYTES } from '../../schemas/finance.ts';
import { ServiceError } from './errors.ts';

const EXT: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp'
};

/** Step 1: a pending private media row and one presigned PUT */
export async function createProofUpload(
	db: DbOrTx,
	storage: FileStorage,
	input: { filename: string; mime: string },
	userId: string | null
) {
	const ext = EXT[input.mime];
	if (!ext) throw new ServiceError('Bukti harus berupa gambar JPG, PNG, atau WebP.');
	const id = randomUUID();
	const key = `proofs/${id}/proof.${ext}`;
	await db.insert(media).values({
		id,
		kind: 'image',
		bucket: PRIVATE_BUCKET,
		key,
		filename: input.filename.slice(0, 200),
		mime: input.mime,
		alt: 'Bukti pembayaran',
		uploadedBy: userId,
		status: 'pending'
	});
	const upload = await storage.uploadUrl(PRIVATE_BUCKET, key, input.mime);
	return { id, upload: { key, ...upload } };
}

/** Step 2: the object must be in the bucket and within the size limit */
export async function confirmProofUpload(db: DbOrTx, storage: FileStorage, id: string) {
	const [row] = await db
		.select()
		.from(media)
		.where(and(eq(media.id, id), eq(media.bucket, PRIVATE_BUCKET)));
	if (!row || !row.key) throw new ServiceError('Bukti tidak ditemukan.');
	if (row.status === 'ready') return row;
	const bytes = await storage.size(PRIVATE_BUCKET, row.key);
	if (bytes === null) throw new ServiceError('Unggahan belum lengkap. Coba unggah ulang.');
	if (bytes > PROOF_MAX_BYTES) {
		await storage.remove(PRIVATE_BUCKET, [row.key]);
		await db.delete(media).where(eq(media.id, id));
		throw new ServiceError('Ukuran bukti maksimal 10 MB.');
	}
	const [ready] = await db
		.update(media)
		.set({ status: 'ready', bytes })
		.where(eq(media.id, id))
		.returning();
	return ready;
}

/** Object key of a ready proof, for the download redirect */
export async function proofKey(db: DbOrTx, id: string) {
	const [row] = await db
		.select({ key: media.key })
		.from(media)
		.where(and(eq(media.id, id), eq(media.bucket, PRIVATE_BUCKET), eq(media.status, 'ready')));
	return row?.key ?? null;
}
