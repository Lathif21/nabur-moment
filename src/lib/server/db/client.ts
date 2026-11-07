// Shared with scripts (migrations, seed, create-user): relative imports only,
// no $env / $lib / @sveltejs/kit.
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.ts';

/**
 * `url` is the Neon pooled connection string (-pooler). node-postgres is Neon's recommended
 * driver on Vercel (with attachDatabasePool) and gives real transactions.
 * The pool is available as `db.$client`.
 */
export function createDb(url: string) {
	const pool = new Pool({
		connectionString: url,
		// Neon suspends an idle compute after ~5 min and drops its connections; never keep an idle
		// connection long enough to be handed out after it was closed on the server side.
		idleTimeoutMillis: 60_000,
		// A cold Neon compute takes a few seconds to wake; fail clearly instead of hanging.
		connectionTimeoutMillis: 15_000,
		keepAlive: true
	});
	// A connection the server resets (Neon suspend, network blip) emits 'error'. Without a listener
	// Node treats it as unhandled and the process exits. pg discards the broken client on release;
	// the query that was using it still fails with a normal error.
	pool.on('connect', (client) => {
		client.on('error', (err) => console.warn('[db] connection error:', err.message));
	});
	pool.on('error', (err) => {
		console.warn('[db] idle connection closed:', err.message);
	});
	return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** First argument of every service: the app's db or an open transaction */
export type DbOrTx = Db | Tx;
