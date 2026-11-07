import { attachDatabasePool } from '@vercel/functions';
import { building } from '$app/env';
import { DATABASE_URL } from '$app/env/private';
import { createDb } from './client.ts';

if (!DATABASE_URL && !building) throw new Error('DATABASE_URL is not set');

// pg connects lazily, so the placeholder is never dialled during `vite build`
export const db = createDb(DATABASE_URL ?? 'postgres://build@localhost/build');

// On Vercel (Fluid compute) this keeps the instance alive until idle connections are closed;
// a no-op everywhere else.
attachDatabasePool(db.$client);

export type { Db, Tx, DbOrTx } from './client.ts';
export * from './schema/index.ts';
