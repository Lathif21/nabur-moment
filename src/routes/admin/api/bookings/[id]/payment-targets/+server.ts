import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '#lib/server/db/index.ts';
import { requirePerm } from '#lib/server/guards.ts';
import { paymentTargets } from '#lib/server/services/payments.ts';
import type { RequestHandler } from './$types';

/** The payment form: open invoices and installments of a booking, with the amount still open */
export const GET: RequestHandler = async ({ locals, params }) => {
	requirePerm(locals, 'payments', 'create');
	if (!z.uuid().safeParse(params.id).success) error(404, 'Booking tidak ditemukan.');
	return json(await paymentTargets(db, params.id));
};
