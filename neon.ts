import { defineConfig } from '@neon/config/v1';

// Neon project for Nabur Moment: region aws-ap-southeast-1 (next to Vercel sin1),
// branches `production` (default) and `dev` (local + preview deploys).
export default defineConfig({
	auth: false,
	// Buckets (site-media, private-files) are declared in P1-01.
	buckets: {},
	branch: (branch) => {
		if (branch.isDefault) return {};
		// Long-lived development branch (local `npm run dev`, preview deploys, demo seed)
		if (branch.name === 'dev') return {};
		// New throwaway branches (`neon checkout <name>`) expire on their own
		if (!branch.exists) return { ttl: '7d' };
		return {};
	}
});
