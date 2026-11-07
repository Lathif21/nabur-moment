// Klien form actions shared by the list (/admin/klien) and the client page (/admin/klien/[id]).
import { fail, type RequestEvent } from '@sveltejs/kit';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import { clientArchiveSchema, clientIdSchema, clientSchema } from '#lib/schemas/crm.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { createClient, setClientArchived, updateClient } from '#lib/server/services/clients.ts';
import { ServiceError } from '#lib/server/services/errors.ts';

type Event = Pick<RequestEvent, 'request' | 'locals'>;

function serviceFail(e: unknown) {
	if (!(e instanceof ServiceError)) throw e;
	return e.field
		? fail(400, { fields: { [e.field]: e.message } })
		: fail(400, { error: e.message });
}

export async function createClientAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'clients', 'create');
	const parsed = clientSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		const row = await createClient(db, parsed.data, me.id);
		return { done: `Klien ${parsed.data.name} ditambahkan.`, id: row.id };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function updateClientAction({ request, locals }: Event) {
	requirePerm(locals, 'clients', 'update');
	const form = formObject(await request.formData());
	const id = clientIdSchema.safeParse(form);
	const parsed = clientSchema.safeParse(form);
	if (!id.success) return fail(400, { error: 'Klien tidak valid.' });
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		await updateClient(db, id.data.id, parsed.data);
		return { done: 'Data klien disimpan.', id: id.data.id };
	} catch (e) {
		return serviceFail(e);
	}
}

/** Archive counts as delete in the permission matrix; restoring as update */
export async function archiveClientAction({ request, locals }: Event) {
	const form = formObject(await request.formData());
	const parsed = clientArchiveSchema.safeParse(form);
	if (!parsed.success) return fail(400, { error: 'Data tidak valid.' });
	requirePerm(locals, 'clients', parsed.data.archived ? 'delete' : 'update');
	try {
		const row = await setClientArchived(db, parsed.data.id, parsed.data.archived);
		return {
			done: parsed.data.archived
				? `${row.name} diarsipkan.`
				: `${row.name} dikembalikan dari arsip.`
		};
	} catch (e) {
		return serviceFail(e);
	}
}
