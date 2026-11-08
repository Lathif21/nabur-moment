// Booking form actions shared by the board (/admin/booking), the list (/admin/booking/daftar) and
// the booking page (/admin/booking/[id]).
import { fail, type RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import { STAGE_LABEL } from '#lib/crm.ts';
import { fieldErrors, formObject } from '#lib/schemas/access.ts';
import {
	activitySchema,
	bookingMoveSchema,
	bookingSchema,
	deliverySchema
} from '#lib/schemas/crm.ts';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { addBookingActivity } from '#lib/server/services/activity.ts';
import {
	createBooking,
	moveBooking,
	updateBooking,
	updateDelivery
} from '#lib/server/services/bookings.ts';
import { ServiceError } from '#lib/server/services/errors.ts';

type Event = Pick<RequestEvent, 'request' | 'locals'>;

/** Session / add-on row errors keep their full path (sessions.0.date) next to the first-level ones */
function bookingFieldErrors(issues: z.core.$ZodIssue[]) {
	const out = fieldErrors(issues);
	for (const i of issues) if (i.path.length > 1) out[i.path.join('.')] ??= i.message;
	return out;
}

/** `need` tells the board which modal to open (dp / lostReason / confirmBalance) */
function serviceFail(e: unknown) {
	if (!(e instanceof ServiceError)) throw e;
	return e.field
		? fail(400, { fields: { [e.field]: e.message }, error: e.message, need: e.field })
		: fail(400, { error: e.message });
}

export async function createBookingAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'bookings', 'create');
	const parsed = bookingSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: bookingFieldErrors(parsed.error.issues) });
	// Creating a client inline needs the client permission too
	if (!parsed.data.clientId) requirePerm(locals, 'clients', 'create');
	try {
		const made = await createBooking(db, parsed.data, me.id);
		return { done: `Booking ${parsed.data.title} dibuat.`, id: made.id };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function updateBookingAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'bookings', 'update');
	const form = formObject(await request.formData());
	const id = z.uuid().safeParse(form.id);
	if (!id.success) return fail(400, { error: 'Booking tidak valid.' });
	const parsed = bookingSchema.safeParse(form);
	if (!parsed.success) return fail(400, { fields: bookingFieldErrors(parsed.error.issues) });
	if (!parsed.data.clientId) requirePerm(locals, 'clients', 'create');
	try {
		await updateBooking(db, id.data, parsed.data, me.id);
		return { done: 'Booking disimpan.', id: id.data };
	} catch (e) {
		return serviceFail(e);
	}
}

export async function moveBookingAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'bookings', 'update');
	const parsed = bookingMoveSchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { error: 'Data pemindahan tidak valid.' });
	try {
		const r = await moveBooking(db, parsed.data, me.id);
		return { done: r.changed ? `Dipindahkan ke ${STAGE_LABEL[r.to]}.` : 'Urutan disimpan.' };
	} catch (e) {
		return serviceFail(e);
	}
}

/** Booking page composer: note / call / WhatsApp / meeting */
export async function addActivityAction({ request, locals }: Event) {
	const me = requirePerm(locals, 'bookings', 'update');
	const parsed = activitySchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		await addBookingActivity(db, parsed.data, me.id);
		return { done: 'Aktivitas dicatat.' };
	} catch (e) {
		return serviceFail(e);
	}
}

/** Booking page Pengiriman card */
export async function deliveryAction({ request, locals }: Event) {
	requirePerm(locals, 'bookings', 'update');
	const parsed = deliverySchema.safeParse(formObject(await request.formData()));
	if (!parsed.success) return fail(400, { fields: fieldErrors(parsed.error.issues) });
	try {
		await updateDelivery(db, parsed.data);
		return { done: 'Pengiriman disimpan.' };
	} catch (e) {
		return serviceFail(e);
	}
}
