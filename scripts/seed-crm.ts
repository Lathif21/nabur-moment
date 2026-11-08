// Demo CRM data for the Neon `dev` branch (P2-01): clients, bookings across every stage, sessions,
// add-ons and activity; since P3-06 also DP / pelunasan payments, direct costs and overhead, so the
// Dashboard and Laba Rugi have numbers. Refuses to run unless NEON_BRANCH=dev or the database is local.
// Re-running replaces the previous demo rows (clients tagged with DEMO_TAG in `notes`).
//   npx tsx scripts/seed-crm.ts
// Lead sources are not seeded here: migration 0006_crm inserts the dummy list on every branch.
import { addDays, format } from 'date-fns';
import { eq, inArray, like } from 'drizzle-orm';
import { createDb } from '../src/lib/server/db/client.ts';
import {
	activity,
	booking,
	bookingAddon,
	bookingInstallment,
	bookingSession,
	client,
	expense,
	expenseCategory,
	invoice,
	leadSource,
	payment
} from '../src/lib/server/db/schema/index.ts';
import { nowWib } from '../src/lib/format.ts';
import { ensureSchedule } from '../src/lib/server/services/installments.ts';
import { nextNumber } from '../src/lib/server/services/invoices.ts';

try {
	process.loadEnvFile();
} catch {
	// no .env: use the real environment
}

const DEMO_TAG = '[demo-seed]';

const url = process.env.DATABASE_URL;
if (!url) fail('DATABASE_URL is not set');
const host = new URL(url).hostname;
if (process.env.NEON_BRANCH !== 'dev' && !['localhost', '127.0.0.1'].includes(host))
	fail('refusing to seed: set NEON_BRANCH=dev (demo data never goes to production)');

type Stage = (typeof booking.$inferInsert)['stage'];
type EventType = (typeof booking.$inferInsert)['eventType'];

/** Days from today (WIB) → `yyyy-MM-dd` */
const day = (offset: number) => format(addDays(nowWib(), offset), 'yyyy-MM-dd');
/** Valid fractional-indexing keys for up to 62 rows: a0…a9, aA…aZ, aa…az */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const key = (i: number) => `a${DIGITS[i]}`;

type Demo = {
	client: { name: string; phone: string; instagram?: string; city: string; source: string };
	title: string;
	eventType: EventType;
	stage: Stage;
	price: number;
	package?: { name: string; price: number; inclusions: string[] };
	addons?: { name: string; unitPrice: number; qty?: number }[];
	sessions: { eventType: EventType; offset: number | null; venue?: string; start?: string }[];
	origin?: 'website_form' | 'manual';
	message?: string;
	lostReason?: string;
	/** days ago the DP was paid (stages booked and later) */
	bookedDaysAgo?: number;
};

const silver = {
	name: 'Silver Wedding',
	price: 6_500_000,
	inclusions: ['1 videografer', 'Reels 60 detik', 'Highlight 3 menit']
};
const gold = {
	name: 'Gold Wedding',
	price: 9_500_000,
	inclusions: ['2 videografer', '3 Reels', 'Highlight 5 menit', 'Raw footage']
};
const lamaran = {
	name: 'Lamaran Story',
	price: 3_500_000,
	inclusions: ['1 videografer', 'Reels 60 detik']
};

const DEMOS: Demo[] = [
	{
		client: {
			name: 'Nadia Putri',
			phone: '6281211110001',
			instagram: 'nadiaputri',
			city: 'Bandung',
			source: 'Instagram'
		},
		title: 'Wedding Nadia & Raka',
		eventType: 'wedding',
		stage: 'inquiry',
		price: 0,
		origin: 'website_form',
		message: 'Halo kak, mau tanya paket untuk akad + resepsi bulan depan.',
		sessions: [{ eventType: 'akad', offset: 45 }]
	},
	{
		client: {
			name: 'Sekar Ayu',
			phone: '6281211110002',
			instagram: 'sekarayu',
			city: 'Jakarta',
			source: 'TikTok'
		},
		title: 'Lamaran Sekar & Bima',
		eventType: 'lamaran',
		stage: 'consultation',
		price: lamaran.price,
		package: lamaran,
		sessions: [{ eventType: 'lamaran', offset: 30, venue: 'Rumah mempelai wanita', start: '10:00' }]
	},
	{
		client: { name: 'Dinda Maharani', phone: '6281211110003', city: 'Bogor', source: 'Referral' },
		title: 'Wedding Dinda & Fajar',
		eventType: 'wedding',
		stage: 'quotation',
		price: gold.price + 1_500_000,
		package: gold,
		addons: [{ name: 'Same Day Edit', unitPrice: 1_500_000 }],
		sessions: [
			{ eventType: 'akad', offset: 60, venue: 'Masjid Raya Bogor', start: '08:00' },
			{ eventType: 'resepsi', offset: 60, venue: 'Gedung Kujang', start: '11:00' }
		]
	},
	{
		client: {
			name: 'Rania Salsabila',
			phone: '6281211110004',
			instagram: 'raniasals',
			city: 'Bandung',
			source: 'Instagram'
		},
		title: 'Wedding Rania & Dimas',
		eventType: 'wedding',
		stage: 'booked',
		price: silver.price,
		package: silver,
		bookedDaysAgo: 10,
		sessions: [
			{ eventType: 'akad', offset: 21, venue: 'Pullman Bandung', start: '08:00' },
			{ eventType: 'resepsi', offset: 21, venue: 'Pullman Bandung', start: '18:30' }
		]
	},
	{
		client: { name: 'Ayu Lestari', phone: '6281211110005', city: 'Jakarta', source: 'WhatsApp' },
		title: 'Wedding Ayu & Kevin',
		eventType: 'wedding',
		stage: 'preparation',
		price: gold.price + 2 * 750_000,
		package: gold,
		addons: [{ name: 'Reels tambahan', unitPrice: 750_000, qty: 2 }],
		bookedDaysAgo: 40,
		sessions: [
			{ eventType: 'lamaran', offset: 5, venue: 'Rumah keluarga' },
			// same date as Rania's akad: shows the same-date warning
			{ eventType: 'resepsi', offset: 21, venue: 'Hotel Mulia', start: '19:00' }
		]
	},
	{
		client: { name: 'Putri Anjani', phone: '6281211110006', city: 'Bandung', source: 'Website' },
		title: 'Akad Putri & Yoga',
		eventType: 'akad',
		stage: 'event_day',
		price: silver.price,
		package: silver,
		bookedDaysAgo: 60,
		sessions: [{ eventType: 'akad', offset: 0, venue: 'Masjid Pusdai', start: '09:00' }]
	},
	{
		client: {
			name: 'Laras Wening',
			phone: '6281211110007',
			instagram: 'laraswening',
			city: 'Yogyakarta',
			source: 'Vendor partner'
		},
		title: 'Wedding Laras & Adit',
		eventType: 'wedding',
		stage: 'editing',
		price: gold.price,
		package: gold,
		bookedDaysAgo: 90,
		sessions: [{ eventType: 'resepsi', offset: -7, venue: 'Royal Ambarrukmo', start: '18:00' }]
	},
	{
		client: { name: 'Maya Kirana', phone: '6281211110008', city: 'Bandung', source: 'Instagram' },
		title: 'Prewedding Maya & Rizky',
		eventType: 'prewedding',
		stage: 'completed',
		price: 4_000_000,
		bookedDaysAgo: 120,
		sessions: [{ eventType: 'prewedding', offset: -30, venue: 'Lembang' }]
	},
	{
		client: { name: 'Citra Dewi', phone: '6281211110009', city: 'Cimahi', source: 'TikTok' },
		title: 'Wedding Citra & Hendra',
		eventType: 'wedding',
		stage: 'lost',
		price: silver.price,
		package: silver,
		lostReason: 'Memilih vendor lain (budget)',
		sessions: [{ eventType: 'resepsi', offset: 50 }]
	},
	{
		// second booking for an existing client (same phone): person + event model
		client: {
			name: 'Sekar Ayu',
			phone: '6281211110002',
			instagram: 'sekarayu',
			city: 'Jakarta',
			source: 'TikTok'
		},
		title: 'Wedding Sekar & Bima',
		eventType: 'wedding',
		stage: 'inquiry',
		price: 0,
		sessions: [{ eventType: 'akad', offset: null }]
	}
];

const db = createDb(url);
try {
	await db.transaction(async (tx) => {
		// Remove previous demo rows (bookings first: booking → client is restrict)
		const old = await tx.select({ id: client.id }).from(client).where(eq(client.notes, DEMO_TAG));
		if (old.length) {
			const ids = old.map((c) => c.id);
			const oldBookings = (
				await tx.select({ id: booking.id }).from(booking).where(inArray(booking.clientId, ids))
			).map((b) => b.id);
			if (oldBookings.length) {
				// money rows point at bookings with restrict: they go first
				await tx.delete(payment).where(inArray(payment.bookingId, oldBookings));
				await tx.delete(invoice).where(inArray(invoice.bookingId, oldBookings));
				await tx.delete(expense).where(inArray(expense.bookingId, oldBookings));
			}
			await tx.delete(booking).where(inArray(booking.clientId, ids));
			await tx.delete(client).where(inArray(client.id, ids));
		}
		await tx.delete(expense).where(like(expense.description, `${DEMO_TAG}%`));

		const sources = new Map(
			(await tx.select().from(leadSource)).map((s) => [s.name, s.id] as const)
		);
		const clientIds = new Map<string, string>();
		const categories = new Map(
			(await tx.select().from(expenseCategory)).map((c) => [c.name, c.id] as const)
		);
		const category = (name: string) => {
			const id = categories.get(name) ?? categories.values().next().value;
			if (!id) fail('no expense categories: run the migrations first');
			return id as string;
		};
		let payments = 0;
		let expenses = 0;
		const perStage = new Map<Stage, number>();
		const now = new Date();

		for (const d of DEMOS) {
			let clientId = clientIds.get(d.client.phone);
			if (!clientId) {
				const [c] = await tx
					.insert(client)
					.values({
						name: d.client.name,
						phone: d.client.phone,
						instagram: d.client.instagram ?? null,
						city: d.client.city,
						sourceId: sources.get(d.client.source) ?? null,
						notes: DEMO_TAG
					})
					.returning({ id: client.id });
				clientId = c.id;
				clientIds.set(d.client.phone, clientId);
			}

			const n = perStage.get(d.stage) ?? 0;
			perStage.set(d.stage, n + 1);
			const bookedAt = d.bookedDaysAgo === undefined ? null : addDays(now, -d.bookedDaysAgo);

			const [b] = await tx
				.insert(booking)
				.values({
					clientId,
					title: d.title,
					eventType: d.eventType,
					packageSnapshot: d.package ?? null,
					agreedPrice: d.price,
					stage: d.stage,
					position: key(n),
					origin: d.origin ?? 'manual',
					inquiryMessage: d.message ?? null,
					lostReason: d.lostReason ?? null,
					bookedAt,
					stageChangedAt: now
				})
				.returning({ id: booking.id });

			await tx.insert(bookingSession).values(
				d.sessions.map((s, i) => ({
					bookingId: b.id,
					eventType: s.eventType,
					date: s.offset === null ? null : day(s.offset),
					startTime: s.start ?? null,
					venue: s.venue ?? null,
					sort: i
				}))
			);

			if (d.addons?.length)
				await tx.insert(bookingAddon).values(
					d.addons.map((a) => ({
						bookingId: b.id,
						name: a.name,
						unitPrice: a.unitPrice,
						qty: a.qty ?? 1
					}))
				);
			await ensureSchedule(tx, b.id);

			// Money (P3-04 / P3-05): the DP on the day it was paid; the pelunasan once Hari H has
			// passed and the booking is done; a crew fee as the direct cost
			if (d.bookedDaysAgo !== undefined) {
				const [dp, pelunasan] = await tx
					.select()
					.from(bookingInstallment)
					.where(eq(bookingInstallment.bookingId, b.id))
					.orderBy(bookingInstallment.sort);
				const paidOn = day(-d.bookedDaysAgo);
				await tx.insert(payment).values({
					bookingId: b.id,
					installmentId: dp.id,
					receiptNumber: await nextNumber(tx, 'KW', paidOn),
					paidOn,
					amount: dp.amount,
					method: 'transfer',
					note: DEMO_TAG
				});
				payments++;
				const first = Math.min(...d.sessions.map((s) => s.offset ?? Infinity));
				if (d.stage === 'completed' && first < 0) {
					const on = day(first);
					await tx.insert(payment).values({
						bookingId: b.id,
						installmentId: pelunasan.id,
						receiptNumber: await nextNumber(tx, 'KW', on),
						paidOn: on,
						amount: pelunasan.amount,
						method: 'transfer',
						note: DEMO_TAG
					});
					payments++;
				}
				await tx.insert(expense).values({
					spentOn: day(first < 0 ? first : -1),
					amount: Math.round((d.price * 0.15) / 1000) * 1000,
					categoryId: category('Fee crew'),
					bookingId: b.id,
					description: `${DEMO_TAG} fee second shooter`,
					method: 'transfer'
				});
				expenses++;
			}

			await tx.insert(activity).values([
				{
					clientId,
					bookingId: b.id,
					type: d.origin === 'website_form' ? 'system' : 'note',
					body:
						d.origin === 'website_form'
							? 'Inquiry masuk dari formulir website'
							: 'Booking dibuat (data demo)',
					occurredAt: addDays(now, -(d.bookedDaysAgo ?? 0) - 3)
				},
				...(d.stage !== 'inquiry'
					? [
							{
								clientId,
								bookingId: b.id,
								type: 'stage_change' as const,
								meta: { from: 'inquiry', to: d.stage },
								occurredAt: now
							}
						]
					: [])
			]);
		}

		// Overhead (no booking): this month and the one before
		const overhead: [string, number, number][] = [
			['Iklan', 750_000, -3],
			['Langganan aplikasi', 300_000, -10],
			['Iklan', 500_000, -35],
			['Alat / Gear', 1_200_000, -45]
		];
		for (const [name, amount, offset] of overhead) {
			await tx.insert(expense).values({
				spentOn: day(offset),
				amount,
				categoryId: category(name),
				bookingId: null,
				description: `${DEMO_TAG} ${name.toLowerCase()}`,
				method: 'transfer'
			});
			expenses++;
		}

		console.log(
			`Seeded ${clientIds.size} demo clients, ${DEMOS.length} bookings, ${payments} payments and ${expenses} expenses (replaced ${old.length} old clients)`
		);
	});
} catch (e) {
	fail(String(e));
} finally {
	await db.$client.end();
}
process.exit(0);

function fail(message: string): never {
	console.error(`Error: ${message}`);
	process.exit(1);
}
