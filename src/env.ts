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
	// Local fallback: `neon config apply` / `neon env pull` write the AWS_* names into .env
	AWS_ACCESS_KEY_ID: {
		description: 'Local only: see NEON_STORAGE_ACCESS_KEY_ID',
		schema: optional
	},
	AWS_SECRET_ACCESS_KEY: {
		description: 'Local only: see NEON_STORAGE_SECRET_ACCESS_KEY',
		schema: optional
	},
	AWS_ENDPOINT_URL_S3: { description: 'Local only: see NEON_STORAGE_ENDPOINT', schema: optional },
	AWS_REGION: { description: 'Local only: see NEON_STORAGE_REGION', schema: optional },
	RESEND_API_KEY: {
		description: 'Resend API key for password reset emails (local dev prints the mail instead)',
		schema: optional
	},
	EMAIL_FROM: {
		description:
			'Sender of password reset emails, on a domain verified in Resend, e.g. `Nabur Moment <noreply@naburmoment.com>`',
		schema: optional
	},
	// WhatsApp alert to the owner on each /booking inquiry, through a self-hosted OpenWA gateway
	// (github.com/rmyndharis/OpenWA). All four set = on; any missing = off (local dev logs it).
	OPENWA_URL: {
		description:
			'OpenWA base URL without `/api`, e.g. `https://wa.example.com` (default port 2785)',
		schema: optional
	},
	OPENWA_API_KEY: {
		description: 'OpenWA API key (OPERATOR or higher), sent as `X-API-Key`',
		schema: optional
	},
	OPENWA_SESSION_ID: {
		description: 'OpenWA session id whose WhatsApp number sends the alert (QR already scanned)',
		schema: optional
	},
	OPENWA_NOTIFY_TO: {
		description: 'WhatsApp number that receives inquiry alerts, e.g. `0812…` or `628…`',
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
	// Set by Vercel itself: this deployment's own host, and (when Protection Bypass for Automation is
	// on) the secret that gets past preview deployment protection. Used to revalidate preview pages.
	VERCEL_URL: {
		description: 'Vercel system variable: host of this deployment (no protocol)',
		schema: optional
	},
	VERCEL_BRANCH_URL: {
		description: 'Vercel system variable: git branch host of a preview deploy (no protocol)',
		schema: optional
	},
	VERCEL_AUTOMATION_BYPASS_SECRET: {
		description: 'Vercel system variable: Protection Bypass for Automation secret',
		schema: optional
	},
	PUBLIC_SITE_URL: {
		description:
			'Canonical public URL for links, sitemap and Open Graph (planned https://naburmoment.com)',
		schema: optional
	}
});
