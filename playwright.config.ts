// Smoke tests: `npm run test:e2e`. By default they run against a local dev server (started for you
// if not running). E2E_BASE_URL overrides the target. PW_CHANNEL picks an installed browser
// (Windows default: Edge, so no browser download is needed).
// Preview deploy (P4-02): E2E_BASE_URL=https://<deployment>.vercel.app plus
// VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Settings → Deployment Protection → Protection Bypass
// for Automation) gets past Vercel's login wall. Preview deploys use the Neon dev branch, so the
// DB specs keep working with NEON_BRANCH=dev.
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(baseURL);
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
	testDir: './tests/e2e',
	// Limited user + role on the dev branch for the permission tests
	globalSetup: './tests/e2e/global-setup.ts',
	workers: 1,
	fullyParallel: false,
	timeout: 60_000,
	// Server actions on the remote Neon dev branch can take a few seconds on a cold dev server
	expect: { timeout: 15_000 },
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL,
		channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
		locale: 'id-ID',
		timezoneId: 'Asia/Jakarta',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		// The bypass cookie also covers the browser's own follow-up requests
		extraHTTPHeaders:
			!local && bypass
				? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
				: undefined
	},
	webServer: local
		? {
				command: 'npm run dev -- --port 5173 --strictPort',
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000
			}
		: undefined
});
