// Lets the admin upload straight to the branch's buckets from the browser (CORS on site-media and
// private-files). Run once per branch, and again when the admin's URL changes.
// npm run storage:cors -- --origin http://localhost:5173 --origin https://nabur-moment.vercel.app
//                        [--env-file .env.production-storage]
// Uses NEON_STORAGE_* or the AWS_* names from .env (= the dev branch) unless --env-file is given.
import { allowBrowserUploads, storageConfig } from '../src/lib/server/storage/files.ts';

const arg = (name: string) =>
	process.argv.flatMap((a, i, all) => (a === name && all[i + 1] ? [all[i + 1]] : []));

const envFile = arg('--env-file')[0];
try {
	process.loadEnvFile(envFile ?? '.env');
} catch {
	if (envFile) {
		console.error(`Cannot read ${envFile}`);
		process.exit(1);
	}
}

const origins = arg('--origin').map((o) => o.replace(/\/$/, ''));
if (!origins.length) {
	console.error('Pass at least one --origin, e.g. --origin http://localhost:5173');
	process.exit(1);
}
const config = storageConfig(process.env);
if (!config) {
	console.error(
		'No storage credentials: run `neon config apply --branch dev` or set NEON_STORAGE_*'
	);
	process.exit(1);
}
await allowBrowserUploads(config, origins);
console.log(`Browser uploads allowed on ${Object.values(config.buckets).join(', ')}`);
console.log(`(${new URL(config.endpoint).host}) from:`);
for (const o of origins) console.log(`  ${o}`);
