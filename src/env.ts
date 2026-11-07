import { defineEnvVars } from '@sveltejs/kit/env';

// Optional at build time so `vite build` works without secrets; enforced where they are used.
// The list matches docs/04-ARCHITECTURE.md → Environments.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Neon pooled connection string (…-pooler…), used by the app',
		schema: optional
	},
	DATABASE_URL_UNPOOLED: {
		description: 'Neon direct connection string, used by drizzle-kit migrations',
		schema: optional
	},
	BETTER_AUTH_SECRET: {
		description: 'Signs session tokens. At least 32 random characters in production.',
		schema: optional
	},
	BETTER_AUTH_URL: {
		description:
			'Public base URL of the app, e.g. `http://localhost:5173` or `https://naburmoment.com`',
		schema: optional
	},
	// Neon Object Storage of the branch. Values are AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
	// AWS_ENDPOINT_URL_S3 / AWS_REGION from `neon env pull`, renamed because Vercel reserves AWS_*.
	NEON_STORAGE_ACCESS_KEY_ID: {
		description: 'Neon storage access key id (AWS_ACCESS_KEY_ID of the branch)',
		schema: optional
	},
	NEON_STORAGE_SECRET_ACCESS_KEY: {
		description: 'Neon storage secret access key (AWS_SECRET_ACCESS_KEY of the branch)',
		schema: optional
	},
	NEON_STORAGE_ENDPOINT: {
		description: 'Neon storage S3 endpoint of the branch (AWS_ENDPOINT_URL_S3)',
		schema: optional
	},
	NEON_STORAGE_REGION: {
		description: 'Neon storage region, e.g. ap-southeast-1 (AWS_REGION)',
		schema: optional
	},
	NEON_STORAGE_BUCKET_SITE: {
		description: 'Bucket for public site media, e.g. `site-media`',
		schema: optional
	},
	NEON_STORAGE_BUCKET_PRIVATE: {
		description: 'Bucket for private files (payment proofs, receipts), e.g. `private-files`',
		schema: optional
	},
	CRON_SECRET: {
		description: 'Vercel Cron sends it as `Authorization: Bearer …`; cron routes check it',
		schema: optional
	},
	ISR_BYPASS_TOKEN: {
		description: 'ISR bypass token (32+ characters) used to revalidate public pages on publish',
		schema: optional
	},
	INSTAGRAM_APP_ID: {
		description: 'Meta app id for the Instagram API with Instagram Login (home feed)',
		schema: optional
	},
	INSTAGRAM_APP_SECRET: {
		description: 'Meta app secret for the Instagram API with Instagram Login',
		schema: optional
	},
	TOKEN_ENCRYPTION_KEY: {
		description: 'Encrypts the stored Instagram long-lived token (32 random bytes, base64)',
		schema: optional
	},
	PUBLIC_SITE_URL: {
		description:
			'Canonical public URL for links, sitemap and Open Graph (planned https://naburmoment.com)',
		schema: optional
	}
});
