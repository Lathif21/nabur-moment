// Smoke tests: `npm run test:e2e`. By default they run against a local dev server (started for you
// if not running). E2E_BASE_URL overrides the target. PW_CHANNEL picks an installed browser
// (Windows default: Edge, so no browser download is needed).
import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(baseURL);

export default defineConfig({
	testDir: './tests/e2e',
	workers: 1,
	fullyParallel: false,
	timeout: 60_000,
	retries: 0,
	reporter: [['list']],
	use: {
		baseURL,
		channel: process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
		locale: 'id-ID',
		timezoneId: 'Asia/Jakarta',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
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
