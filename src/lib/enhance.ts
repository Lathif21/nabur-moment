import type { SubmitFunction } from '$app/forms';
import { toast } from './toast.ts';

/**
 * `use:enhance` handler for simple actions that return `{ done }` or `fail(4xx, { error })`.
 * Stays on the current URL (SvelteKit 3 otherwise navigates to the action URL and drops the
 * query string), reloads the page data, and only then shows the toast, so the message never
 * appears next to stale data.
 */
export function refreshThenToast(
	hooks: { start?: () => void; end?: (ok: boolean) => void } = {}
): SubmitFunction {
	return () => {
		hooks.start?.();
		return async ({ result, update }) => {
			await update({ navigate: false });
			hooks.end?.(result.type === 'success');
			if (result.type === 'success') toast.success(String(result.data?.done));
			if (result.type === 'failure') toast.error(String(result.data?.error));
		};
	};
}

/**
 * Posts to a form action from code (drag-and-drop reorder), then reloads the page data.
 * Returns the error message on failure.
 */
export async function postAction(
	action: string,
	fields: Record<string, string>
): Promise<string | null> {
	const { deserialize } = await import('$app/forms');
	const { invalidateAll } = await import('$app/navigation');
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, v);
	const res = await fetch(action, {
		method: 'POST',
		body,
		headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await res.text());
	await invalidateAll();
	if (result.type === 'failure') return String(result.data?.error ?? 'Gagal menyimpan.');
	if (result.type === 'error') return 'Gagal menyimpan.';
	return null;
}
