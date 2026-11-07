import { requireUser } from '#lib/server/guards.ts';
import type { LayoutServerLoad } from './$types';

// Guards every page in (app) for a session. Each page load and form action still calls
// requirePerm() itself (CLAUDE.md); the sidebar and buttons use the same `perms`.
export const load: LayoutServerLoad = ({ locals }) => {
	const user = requireUser(locals);
	return {
		user: { name: user.name, email: user.email, isOwner: user.isOwner },
		perms: [...(locals.perms ?? [])]
	};
};
