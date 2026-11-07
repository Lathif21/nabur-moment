// Neon Object Storage (S3 API) for media. Relative imports only and the config is passed in, so
// scripts and DB specs build the same client as the app (storage/index.ts reads the env).
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutBucketCorsCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Public read: everything the public site shows */
export const SITE_BUCKET = 'site-media';
/** Private: payment proofs, receipts; downloads only through a permission-checked route */
export const PRIVATE_BUCKET = 'private-files';

export type Bucket = typeof SITE_BUCKET | typeof PRIVATE_BUCKET;

/** Keys are never reused (one folder per media id), so caches may keep files forever */
export const IMMUTABLE = 'public, max-age=31536000, immutable';

export type StorageConfig = {
	accessKeyId: string;
	secretAccessKey: string;
	/** The branch's S3 endpoint (AWS_ENDPOINT_URL_S3) */
	endpoint: string;
	region: string;
	/** Bucket names, overridable per environment */
	buckets: Record<Bucket, string>;
};

/** NEON_STORAGE_* first (Vercel), then the AWS_* names `neon env pull` writes locally */
export function storageConfig(env: Record<string, string | undefined>): StorageConfig | null {
	const pick = (own: string, aws: string) => env[own] || env[aws] || '';
	const config: StorageConfig = {
		accessKeyId: pick('NEON_STORAGE_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID'),
		secretAccessKey: pick('NEON_STORAGE_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY'),
		endpoint: pick('NEON_STORAGE_ENDPOINT', 'AWS_ENDPOINT_URL_S3').replace(/\/$/, ''),
		region: pick('NEON_STORAGE_REGION', 'AWS_REGION') || 'ap-southeast-1',
		buckets: {
			[SITE_BUCKET]: env.NEON_STORAGE_BUCKET_SITE || SITE_BUCKET,
			[PRIVATE_BUCKET]: env.NEON_STORAGE_BUCKET_PRIVATE || PRIVATE_BUCKET
		}
	};
	return config.accessKeyId && config.secretAccessKey && config.endpoint ? config : null;
}

/** What the media service needs from the bucket; unit tests can pass a fake */
export type FileStorage = {
	/**
	 * A presigned PUT the browser uploads to. It must send exactly `headers` (they are signed).
	 */
	uploadUrl(
		bucket: Bucket,
		key: string,
		contentType: string
	): Promise<{ url: string; headers: Record<string, string> }>;
	/** Size of a stored object, or null when it is not there */
	size(bucket: Bucket, key: string): Promise<number | null>;
	remove(bucket: Bucket, keys: string[]): Promise<void>;
	/** Anonymous URL of a public site file (site-media is public_read) */
	publicUrl(key: string): string;
	/** Short-lived download link for a private file */
	downloadUrl(key: string, expiresIn?: number): Promise<string>;
};

export function neonStorage(config: StorageConfig): FileStorage {
	const s3 = new S3Client({
		region: config.region,
		endpoint: config.endpoint,
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
		// Neon requires path-style addressing
		forcePathStyle: true
	});
	const name = (b: Bucket) => config.buckets[b];

	return {
		async uploadUrl(bucket, key, contentType) {
			const cacheControl = bucket === SITE_BUCKET ? IMMUTABLE : 'private, no-store';
			const url = await getSignedUrl(
				s3,
				new PutObjectCommand({
					Bucket: name(bucket),
					Key: key,
					ContentType: contentType,
					CacheControl: cacheControl
				}),
				// Long enough for a big video on a slow connection
				{ expiresIn: 6 * 3600 }
			);
			return { url, headers: { 'Content-Type': contentType, 'Cache-Control': cacheControl } };
		},
		async size(bucket, key) {
			try {
				const head = await s3.send(new HeadObjectCommand({ Bucket: name(bucket), Key: key }));
				return head.ContentLength ?? 0;
			} catch (e) {
				const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
				if (status === 404) return null;
				throw e;
			}
		},
		async remove(bucket, keys) {
			if (!keys.length) return;
			await s3.send(
				new DeleteObjectsCommand({
					Bucket: name(bucket),
					Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
				})
			);
		},
		publicUrl: (key) => `${config.endpoint}/${name(SITE_BUCKET)}/${key}`,
		downloadUrl: (key, expiresIn = 300) =>
			getSignedUrl(s3, new GetObjectCommand({ Bucket: name(PRIVATE_BUCKET), Key: key }), {
				expiresIn
			})
	};
}

/** CORS for browser uploads (PUT) from the admin's origins, on both buckets */
export async function allowBrowserUploads(config: StorageConfig, origins: string[]) {
	const s3 = new S3Client({
		region: config.region,
		endpoint: config.endpoint,
		credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
		forcePathStyle: true
	});
	for (const bucket of Object.values(config.buckets)) {
		await s3.send(
			new PutBucketCorsCommand({
				Bucket: bucket,
				CORSConfiguration: {
					CORSRules: [
						{
							AllowedOrigins: origins,
							AllowedMethods: ['PUT', 'GET', 'HEAD'],
							AllowedHeaders: ['*'],
							ExposeHeaders: ['ETag'],
							MaxAgeSeconds: 3600
						}
					]
				}
			})
		);
	}
}
