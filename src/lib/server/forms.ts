// Form-action helpers: turn a ServiceError into a 400 with a message a person can act on.
import { fail } from '@sveltejs/kit';
import { ServiceError } from './services/errors.ts';

/** Run a service call and report `{ done }`, or `fail(400, { error })` on a rule violation */
export async function runSimpleAction(work: () => Promise<unknown>, done: string) {
	try {
		await work();
		return { done };
	} catch (e) {
		if (e instanceof ServiceError) return fail(400, { error: e.message });
		throw e;
	}
}
