// DB spec for invoices (P3-02). Neon `dev` branch (NEON_BRANCH=dev) or localhost only.
// Storage cases run in a rolled-back transaction; the numbering case uses separate connections that
// commit (so the counter row is really contended), in the year 2098, and deletes what it made.
import { eq, inArray, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../../schemas/crm';
import { customInvoiceSchema } from '../../schemas/finance';
import { createDb, type Tx } from '../db/client';
import {
	addon,
	booking,
	client,
	counter,
	invoice,
	packageCategory,
	payment,
	pkg
} from '../db/schema/index';
import { createBooking, moveBooking } from './bookings';
import { ServiceError } from './errors';
import { listSchedule } from './installments';
import {
	createCustomInvoice,
	createInstallmentInvoice,
	getInvoice,
	listBookingInvoices,
	listInvoices,
	markInvoiceSent,
	refreshOverdue,
	voidInvoice
} from './invoices';

try {
	process.loadEnvFile();
} catch {
	// no .env
}
const url = process.env.DATABASE_URL;
const isDevDb =
	!!url &&
	(process.env.NEON_BRANCH === 'dev' || ['localhost', '127.0.0.1'].includes(new URL(url).hostname));

class Rollback extends Error {}

async function inRollback(fn: (tx: Tx) => Promise<void>) {
	const db = createDb(url!);
	try {
		await db.transaction(async (tx) => {
			await fn(tx);
			throw new Rollback();
		});
	} catch (e) {
		if (!(e instanceof Rollback)) throw e;
	} finally {
		await db.$client.end();
	}
}

const bookingInput = (phone: string, over: Record<string, unknown> = {}) =>
	bookingSchema.parse({
		newClientName: 'E2E CRM Spec Invoice',
		newClientPhone: phone,
		title: 'E2E CRM Invoice',
		eventType: 'wedding',
		agreedPrice: '10000000',
		sessions: JSON.stringify([{ eventType: 'akad', date: '2031-09-09' }]),
		addons: JSON.stringify([{ addonId: null, name: 'Drone', unitPrice: 1_000_000, qty: 1 }]),
		...over
	});

const custom = (bookingId: string, issueDate = '2031-08-01', dueDate = '2031-08-15') =>
	customInvoiceSchema.parse({
		bookingId,
		issueDate,
		dueDate,
		items: JSON.stringify([
			{ description: 'Tambahan 2 jam', qty: 2, unitPrice: 750_000 },
			{ description: 'Reels tambahan', qty: 1, unitPrice: 500_000 }
		])
	});

async function rejects(p: Promise<unknown>, text: RegExp) {
	const e = await p.then(
		() => null,
		(err: unknown) => err
	);
	expect(e).toBeInstanceOf(ServiceError);
	expect((e as ServiceError).message).toMatch(text);
}

describe.runIf(isDevDb)('invoices', () => {
	it('bills an installment once, with the contract lines; custom invoices total their lines', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, bookingInput('0899-7006-0001'), null);
			const [dp, pelunasan] = await listSchedule(tx, made.id);

			const inv = await createInstallmentInvoice(
				tx,
				{ installmentId: dp.id, issueDate: '2031-08-01', dueDate: '2031-08-08', notes: null },
				null
			);
			expect(inv.number).toMatch(/^INV\/NM\/2031\/08\/\d{3,}$/);
			expect(inv).toMatchObject({ status: 'draft', total: 5_000_000, installmentId: dp.id });
			// No package: the agreed price no longer equals the add-on line, so one contract line
			expect(inv.items).toEqual([
				{
					description: 'Jasa dokumentasi + add-on (E2E CRM Invoice), harga disepakati',
					qty: 1,
					unitPrice: 10_000_000,
					details: ['Add-on: Drone']
				}
			]);
			await rejects(
				createInstallmentInvoice(
					tx,
					{ installmentId: dp.id, issueDate: '2031-08-02', dueDate: '2031-08-09', notes: null },
					null
				),
				/sudah punya invoice/
			);

			const extra = await createCustomInvoice(tx, custom(made.id), null);
			expect(extra.total).toBe(2_000_000);

			// Void the DP invoice: the installment can be billed again
			await voidInvoice(tx, inv.id, null);
			const again = await createInstallmentInvoice(
				tx,
				{ installmentId: dp.id, issueDate: '2031-08-03', dueDate: '2031-08-10', notes: null },
				null
			);
			expect(again.total).toBe(5_000_000);
			expect((await listBookingInvoices(tx, made.id)).map((i) => i.status)).toEqual([
				'void',
				'draft',
				'draft'
			]);
			expect(pelunasan.kind).toBe('pelunasan');
		}));

	it('lists what the package and each add-on include under their lines', () =>
		inRollback(async (tx) => {
			const [cat] = await tx
				.insert(packageCategory)
				.values({ name: 'Spec', position: 'a0' })
				.returning();
			const [gold] = await tx
				.insert(pkg)
				.values({
					categoryId: cat.id,
					name: 'Gold Spec',
					price: 9_000_000,
					inclusions: ['2 fotografer', ' ', 'Album 30 halaman'],
					position: 'a0'
				})
				.returning();
			const [drone] = await tx
				.insert(addon)
				.values({
					name: 'Drone',
					price: 1_000_000,
					description: 'Foto udara 1 jam',
					position: 'a0'
				})
				.returning();
			const made = await createBooking(
				tx,
				bookingInput('0899-7006-0009', {
					packageId: gold.id,
					addons: JSON.stringify([
						{ addonId: drone.id, name: 'Drone', unitPrice: 1_000_000, qty: 1 },
						{ addonId: null, name: 'Cetak kanvas', unitPrice: 0, qty: 1 }
					])
				}),
				null
			);
			const [dp] = await listSchedule(tx, made.id);
			const inv = await createInstallmentInvoice(
				tx,
				{ installmentId: dp.id, issueDate: '2031-08-01', dueDate: '2031-08-08', notes: null },
				null
			);
			expect(inv.items).toEqual([
				{
					description: 'Paket Gold Spec',
					qty: 1,
					unitPrice: 9_000_000,
					details: ['2 fotografer', 'Album 30 halaman']
				},
				{
					description: 'Add-on: Drone',
					qty: 1,
					unitPrice: 1_000_000,
					details: ['Foto udara 1 jam']
				},
				// A line typed on the booking has no description
				{ description: 'Add-on: Cetak kanvas', qty: 1, unitPrice: 0 }
			]);
		}));

	it('refuses to void an invoice that has a payment', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, bookingInput('0899-7006-0002'), null);
			const inv = await createCustomInvoice(tx, custom(made.id), null);
			await tx.insert(payment).values({
				bookingId: made.id,
				invoiceId: inv.id,
				receiptNumber: `KW/NM/2031/08/T${Date.now()}`,
				paidOn: '2031-08-05',
				amount: 500_000,
				method: 'transfer'
			});
			await rejects(voidInvoice(tx, inv.id, null), /sudah punya pembayaran/);
			expect((await getInvoice(tx, inv.id))!.paid).toBe(500_000);
		}));

	it('sent → overdue after the due date; Batal voids invoices without payments only', () =>
		inRollback(async (tx) => {
			const made = await createBooking(tx, bookingInput('0899-7006-0003'), null);
			const a = await createCustomInvoice(tx, custom(made.id, '2031-08-01', '2031-08-15'), null);
			const b = await createCustomInvoice(tx, custom(made.id, '2031-08-01', '2031-08-20'), null);
			await markInvoiceSent(tx, a.id, null);
			await rejects(markInvoiceSent(tx, a.id, null), /sudah dikirim/);

			await refreshOverdue(tx, '2031-08-16');
			const listed = await listInvoices(tx, { q: 'E2E CRM Invoice', month: '2031-08' });
			const byId = Object.fromEntries(listed.rows.map((r) => [r.id, r.status]));
			expect(byId[a.id]).toBe('overdue');
			expect(byId[b.id]).toBe('draft');

			// b has a payment: it survives the cancellation
			await tx.insert(payment).values({
				bookingId: made.id,
				invoiceId: b.id,
				receiptNumber: `KW/NM/2031/08/U${Date.now()}`,
				paidOn: '2031-08-05',
				amount: 100_000,
				method: 'cash'
			});
			await moveBooking(
				tx,
				{
					id: made.id,
					to: 'lost',
					beforeId: null,
					afterId: null,
					lostReason: 'Uji',
					confirmBalance: false
				},
				null
			);
			const after = Object.fromEntries(
				(await listBookingInvoices(tx, made.id)).map((r) => [r.id, r.status])
			);
			expect(after[a.id]).toBe('void');
			expect(after[b.id]).toBe('draft');
			await rejects(createCustomInvoice(tx, custom(made.id), null), /sudah batal/);
		}));

	it('gives 10 concurrent invoices 10 sequential numbers and restarts each month', async () => {
		const db = createDb(url!);
		let bookingId = '';
		try {
			const made = await createBooking(
				db,
				bookingInput('0899-7006-0099', { title: 'E2E CRM Invoice Konkuren' }),
				null
			);
			bookingId = made.id;
			const jan = await Promise.all(
				Array.from({ length: 10 }, () =>
					createCustomInvoice(db, custom(bookingId, '2098-01-15', '2098-01-30'), null)
				)
			);
			const seqs = jan.map((r) => Number(r.number.split('/').pop())).sort((x, y) => x - y);
			expect(seqs).toEqual(Array.from({ length: 10 }, (_, i) => seqs[0] + i));
			expect(new Set(jan.map((r) => r.number)).size).toBe(10);

			const feb = await createCustomInvoice(
				db,
				custom(bookingId, '2098-02-03', '2098-02-17'),
				null
			);
			expect(feb.number).toBe('INV/NM/2098/02/001');
		} finally {
			if (bookingId) {
				const [b] = await db
					.select({ clientId: booking.clientId })
					.from(booking)
					.where(eq(booking.id, bookingId));
				await db.delete(invoice).where(eq(invoice.bookingId, bookingId));
				await db.delete(booking).where(eq(booking.id, bookingId));
				if (b) await db.delete(client).where(inArray(client.id, [b.clientId]));
			}
			await db.delete(counter).where(like(counter.key, 'INV-2098-%'));
			await db.$client.end();
		}
	});
});
