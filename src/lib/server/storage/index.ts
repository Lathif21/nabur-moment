import { building } from '$app/env';
import * as env from '$app/env/private';
import { neonStorage, storageConfig, type FileStorage } from './files.ts';

const config = storageConfig(env as Record<string, string | undefined>);

/**
 * The branch's bucket client. Null while building or when storage is not configured; routes that
 * need it call `requireStorage()`.
 */
export const storage: FileStorage | null = config ? neonStorage(config) : null;

export function requireStorage(): FileStorage {
	if (!storage) {
		if (building) throw new Error('storage is not available while building');
		throw new Error('Object storage is not configured (NEON_STORAGE_* / AWS_* env vars)');
	}
	return storage;
}

export { SITE_BUCKET, PRIVATE_BUCKET } from './files.ts';
