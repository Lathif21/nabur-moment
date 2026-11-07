// Creates an admin login (public sign-up is disabled).
// npm run user:create -- --email a@naburmoment.com --name "Nama" [--password …] [--owner]
// --owner makes the single owner (refused when one exists). Uses DATABASE_URL from .env or the
// environment, so point it at the right Neon branch.
import { parseArgs } from 'node:util';
import { createDb } from '../src/lib/server/db/client.ts';
import { ServiceError } from '../src/lib/server/services/errors.ts';
import { createUser, MIN_PASSWORD } from '../src/lib/server/services/users.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env: use the real environment
}

const { values } = parseArgs({
	options: {
		email: { type: 'string' },
		name: { type: 'string' },
		password: { type: 'string' },
		owner: { type: 'boolean', default: false }
	}
});

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();

if (!email || !name) fail('--email and --name are required');
if (values.password && values.password.length < MIN_PASSWORD)
	fail(`password must be at least ${MIN_PASSWORD} characters`);
if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set');

const db = createDb(process.env.DATABASE_URL);
try {
	const created = await createUser(db, {
		email,
		name,
		password: values.password,
		isOwner: values.owner
	});
	console.log(`Created ${values.owner ? 'owner' : 'user'} ${name} <${created.email}>`);
	if (created.generated) console.log(`Password: ${created.password}`);
} catch (e) {
	fail(e instanceof ServiceError ? e.message : String(e));
}
process.exit(0);

function fail(message: string): never {
	console.error(`Error: ${message}`);
	process.exit(1);
}
