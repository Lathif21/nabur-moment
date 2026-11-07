import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

// sin1 = Singapore, next to the Neon database (aws-ap-southeast-1): every query is a round trip.
const adapter = vercelAdapter({ regions: ['sin1'] });

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter
		})
	],
	test: {
		expect: { requireAssertions: true },
		// the db project has no specs until P0-02
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'src/**/*.db.spec.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					// Specs against the Neon `dev` branch: one file at a time so slow connections
					// do not time out
					name: 'db',
					environment: 'node',
					include: ['src/**/*.db.spec.ts'],
					fileParallelism: false
				}
			}
		]
	}
});
