// npm run db:migrate:prod: apply pending Drizzle migrations to the PRODUCTION Neon branch.
// The URL comes from .env.production-storage (git-ignored, DATABASE_URL_UNPOOLED), never from
// .env, so tests and `npm run db:migrate` keep pointing at dev. Refuses any host that is not the
// production endpoint and asks for a typed confirmation before running.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseEnv } from 'node:util';

const FILE = '.env.production-storage';
const PRODUCTION_HOST = /^ep-billowing-mode-/;

let url: string | undefined;
try {
	url = parseEnv(readFileSync(FILE, 'utf8')).DATABASE_URL_UNPOOLED;
} catch {
	console.error(`${FILE} not found. Run this from the nabur-moment folder.`);
	process.exit(1);
}
if (!url) {
	console.error(`DATABASE_URL_UNPOOLED is missing in ${FILE}.`);
	process.exit(1);
}

const host = new URL(url).hostname;
console.log(`Target database host: ${host}`);
if (!PRODUCTION_HOST.test(host)) {
	console.error(
		'This is not the production endpoint (ep-billowing-mode-*). Stopped, nothing changed.'
	);
	process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });
const answer = await rl.question('Type "production" to apply pending migrations: ');
rl.close();
if (answer.trim() !== 'production') {
	console.log('Cancelled, nothing changed.');
	process.exit(0);
}

// A variable set here wins over .env (drizzle.config.ts loads .env without overriding)
const run = spawnSync('npx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	shell: true,
	env: { ...process.env, DATABASE_URL_UNPOOLED: url }
});
process.exit(run.status ?? 1);
