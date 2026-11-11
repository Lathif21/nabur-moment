<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import FileDown from '@lucide/svelte/icons/file-down';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import ActivityTimeline from '#lib/components/crm/ActivityTimeline.svelte';
	import BookingDrawer from '#lib/components/crm/BookingDrawer.svelte';
	import BookingMoveDialogs from '#lib/components/crm/BookingMoveDialogs.svelte';
	import MoveMenu from '#lib/components/kanban/MoveMenu.svelte';
	import {
		ACTIVITY_LABEL,
		ADMIN_EVENT_LABEL,
		paymentChip,
		STAGES,
		STAGE_LABEL,
		stageTone,
		waLink
	} from '#lib/crm.ts';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import CustomInvoiceDrawer from '#lib/components/finance/CustomInvoiceDrawer.svelte';
	import DpPaidModal from '#lib/components/finance/DpPaidModal.svelte';
	import ExpenseDrawer from '#lib/components/finance/ExpenseDrawer.svelte';
	import PaymentDrawer from '#lib/components/finance/PaymentDrawer.svelte';
	import InstallmentInvoiceModal from '#lib/components/finance/InstallmentInvoiceModal.svelte';
	import {
		DP_PERCENT,
		INSTALLMENT_LABEL,
		INVOICE_STATUS_LABEL,
		PAYMENT_METHOD_LABEL,
		invoiceTone
	} from '#lib/finance.ts';
	import { countdown, dateID, phoneDisplay, rupiah } from '#lib/format.ts';
	import { MANUAL_ACTIVITY_TYPES } from '#lib/schemas/crm.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const b = $derived(data.booking);
	const open = $derived(b.stage !== 'lost' && b.stage !== 'completed');
	const addonTotal = $derived(b.addons.reduce((s, a) => s + a.unitPrice * a.qty, 0));
	const paid = $derived(data.payments.reduce((sum, p) => sum + p.amount, 0));
	const payChip = $derived(paymentChip({ ...b, paid }));
	const costs = $derived(data.expenses.reduce((sum, e) => sum + e.amount, 0));

	// ---------- expenses (P3-05) ----------
	type Expense = (typeof data.expenses)[number];
	let expenseOpen = $state(false);
	let editingExpense = $state<Expense | null>(null);
	function openExpense(e: Expense | null) {
		editingExpense = e;
		expenseOpen = true;
	}
	let deletingExpense = $state<Expense | null>(null);
	let deleteExpenseOpen = $state(false);

	// ---------- stage ----------
	let dialogs: BookingMoveDialogs;
	let moving = $state(false);
	const targets = $derived(
		STAGES.filter((s) => s.key !== b.stage).map((s) => ({ key: s.key, label: s.label }))
	);
	async function moveTo(to: string) {
		moving = true;
		try {
			// No neighbours: the card goes to the bottom of the new column on the board
			await dialogs.request(
				{ id: b.id, from: b.stage, to, beforeId: null, afterId: null },
				{ title: b.title, bookedAt: b.bookedAt }
			);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Booking gagal dipindahkan.');
		} finally {
			moving = false;
		}
	}

	let editOpen = $state(false);

	// ---------- invoices (P3-02) ----------
	const activeInvoice = (installmentId: string) =>
		data.invoices.find((i) => i.installmentId === installmentId && i.status !== 'void');
	const canBill = (row: (typeof data.schedule)[number]) =>
		data.allow.invoices.create &&
		b.stage !== 'lost' &&
		!row.cancelledAt &&
		row.amount - row.paid > 0;
	let billing = $state<(typeof data.schedule)[number] | null>(null);
	let installmentOpen = $state(false);
	let customOpen = $state(false);
	function openInstallmentInvoice(row: (typeof data.schedule)[number]) {
		billing = row;
		installmentOpen = true;
	}

	/** Until payments exist (P3-04) the DP counts as paid once the booking has `booked_at` */
	function installmentStatus(row: (typeof data.schedule)[number]) {
		if (row.cancelledAt) return { label: 'Dibatalkan', tone: '' };
		if (row.amount > 0 && row.paid >= row.amount) return { label: 'Lunas', tone: 'chip--success' };
		if (row.paid > 0) return { label: `Dibayar ${rupiah(row.paid)}`, tone: 'chip--warning' };
		return { label: 'Belum dibayar', tone: 'chip--warning' };
	}

	// ---------- payments (P3-04) ----------
	let paymentOpen = $state(false);
	let dpPaidOpen = $state(false);
	let deletingPayment = $state<(typeof data.payments)[number] | null>(null);
	let deletePaymentOpen = $state(false);

	// ---------- activity composer ----------
	let noteType = $state<(typeof MANUAL_ACTIVITY_TYPES)[number]>('note');
	let noteBody = $state('');
	let noteError = $state('');
	let noteBusy = $state(false);

	// ---------- delivery ----------
	let deliveryErrors = $state<Record<string, string>>({});
	let deliveryBusy = $state(false);

	function timeRange(s: { startTime: string | null; endTime: string | null }) {
		if (s.startTime && s.endTime) return `${s.startTime}–${s.endTime}`;
		return s.startTime ?? (s.endTime ? `s.d. ${s.endTime}` : null);
	}
</script>

<div class="page-body">
	<a
		class="inline-flex items-center gap-1.5 text-small text-ink-2 hover:underline"
		href={resolve('admin/booking')}
	>
		<ArrowLeft size={14} aria-hidden="true" /> Pipeline booking
	</a>

	<PageHeader
		title={b.title}
		description="{ADMIN_EVENT_LABEL[b.eventType]} · dibuat {dateID(b.createdAt)}{b.origin ===
		'website_form'
			? ' dari formulir website'
			: ''}"
	>
		{#snippet actions()}
			{#if data.allow.update}
				<button type="button" class="btn btn--secondary" onclick={() => (editOpen = true)}>
					<Pencil size={16} aria-hidden="true" /> Ubah
				</button>
				<MoveMenu
					itemLabel={b.title}
					{targets}
					onmove={moveTo}
					disabled={moving}
					buttonText="Pindah tahap"
				/>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Header facts: stage, Hari H, DP, client -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-body" aria-label="Ringkasan booking">
		<span class="chip {stageTone(b.stage)}" data-testid="stage">{STAGE_LABEL[b.stage]}</span>
		<span class="inline-flex items-center gap-1.5">
			<CalendarDays size={16} class="text-ink-2" aria-hidden="true" />
			{#if b.firstDate}
				Hari H {dateID(b.firstDate, 'long')}
				{#if open}<strong>{countdown(b.firstDate)}</strong>{/if}
			{:else}
				<span class="text-ink-2">Tanggal belum ditentukan</span>
			{/if}
		</span>
		{#if payChip}
			<span class="chip {payChip.tone}"
				>{payChip.label}{payChip.label === 'DP lunas' && b.bookedAt
					? ` ${dateID(b.bookedAt)}`
					: ''}</span
			>
		{/if}
		<span class="inline-flex flex-wrap items-center gap-2">
			<a
				class="font-semibold underline-offset-2 hover:underline"
				href={resolve('/admin/(app)/klien/[id]', { id: b.client.id })}>{b.client.name}</a
			>
			{#if b.client.phone}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external WhatsApp link -->
				<a
					class="inline-flex items-center gap-1 text-small text-ink-2 underline-offset-2 hover:underline"
					href={waLink(b.client.phone)}
					target="_blank"
					rel="noopener noreferrer"
				>
					<MessageCircle size={14} aria-hidden="true" />
					{phoneDisplay(b.client.phone)}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</span>
	</div>

	{#if b.stage === 'lost' && b.lostReason}
		<p class="rounded-card border border-line bg-danger-bg px-4 py-3 text-body" role="status">
			<strong>Batal.</strong>
			{b.lostReason}
		</p>
	{/if}

	<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<!-- Main column -->
		<div class="flex min-w-0 flex-col gap-6">
			<section class="flex flex-col gap-3" aria-labelledby="sessions-title">
				<h2 id="sessions-title" class="font-display text-section-title">Sesi</h2>
				{#if b.sessions.length === 0}
					<EmptyState message="Belum ada sesi." />
				{:else}
					<ul class="card divide-y divide-line">
						{#each b.sessions as s, i (s.id)}
							<li class="flex flex-col gap-1 px-4 py-3">
								<p class="flex flex-wrap items-center gap-2">
									<span class="font-semibold">{ADMIN_EVENT_LABEL[s.eventType]}</span>
									{#if i === 0 && s.date}<span class="chip">Hari H</span>{/if}
								</p>
								<p class="text-body">
									{s.date ? dateID(s.date, 'long') : 'Tanggal belum ditentukan'}{#if timeRange(s)}
										· {timeRange(s)} WIB{/if}
								</p>
								{#if s.venue || s.city}
									<p class="inline-flex items-center gap-1.5 text-small text-ink-2">
										<MapPin size={14} aria-hidden="true" />
										{[s.venue, s.city].filter(Boolean).join(', ')}
									</p>
								{/if}
								{#if s.notes}<p class="text-small whitespace-pre-line text-ink-2">{s.notes}</p>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="crew-title">
				<h2 id="crew-title" class="font-display text-section-title">Kru</h2>
				{#if b.crew.length === 0}
					<p class="card px-4 py-3 text-body text-ink-2">
						Belum ada kru.{#if data.allow.update}
							Pilih lewat Ubah booking.{/if}
					</p>
				{:else}
					<ul class="card divide-y divide-line">
						{#each b.crew as k (k.id)}
							<li class="px-4 py-3">
								{#if data.allow.crew}
									<a
										class="font-semibold underline-offset-2 hover:underline"
										href={resolve('/admin/(app)/kru/[id]', { id: k.id })}>{k.name}</a
									>
								{:else}<span class="font-semibold">{k.name}</span>{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="package-title">
				<h2 id="package-title" class="font-display text-section-title">Paket & add-on</h2>
				<div class="card flex flex-col gap-3 px-4 py-3">
					{#if b.packageSnapshot}
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<p>
								<span class="font-semibold">{b.packageSnapshot.name}</span>
								{#if b.packageSnapshot.category}<span class="text-small text-ink-2">
										· {b.packageSnapshot.category}</span
									>{/if}
							</p>
							<span class="tabular-nums">{rupiah(b.packageSnapshot.price)}</span>
						</div>
						{#if b.packageSnapshot.inclusions.length}
							<ul class="list-disc pl-5 text-small text-ink-2">
								{#each b.packageSnapshot.inclusions as item, i (i)}<li>{item}</li>{/each}
							</ul>
						{/if}
					{:else}
						<p class="text-body text-ink-2">Tanpa paket.</p>
					{/if}
					{#if b.addons.length}
						<ul class="flex flex-col gap-1 border-t border-line pt-3">
							{#each b.addons as a (a.id)}
								<li class="flex justify-between gap-3 text-body">
									<span>{a.name}{a.qty > 1 ? ` × ${a.qty}` : ''}</span>
									<span class="tabular-nums">{rupiah(a.unitPrice * a.qty)}</span>
								</li>
							{/each}
						</ul>
					{/if}
					<p class="flex justify-between gap-3 border-t border-line pt-3 font-semibold">
						<span>Harga disepakati</span>
						<span class="tabular-nums">{rupiah(b.agreedPrice)}</span>
					</p>
					{#if b.packageSnapshot && b.agreedPrice !== b.packageSnapshot.price + addonTotal}
						<p class="text-small text-ink-2">
							Harga diubah manual (paket + add-on = {rupiah(b.packageSnapshot.price + addonTotal)}).
						</p>
					{/if}
				</div>
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="payments-title">
				<h2 id="payments-title" class="font-display text-section-title">Pembayaran</h2>
				<div class="card table-wrap">
					<table class="table" aria-label="Jadwal pembayaran">
						<thead>
							<tr>
								<th scope="col">Termin</th>
								<th scope="col">Jatuh tempo</th>
								<th scope="col" class="text-right">Jumlah</th>
								<th scope="col">Status</th>
								<th scope="col">Invoice</th>
							</tr>
						</thead>
						<tbody>
							{#each data.schedule as row (row.id)}
								{@const inv = activeInvoice(row.id)}
								{@const status = installmentStatus(row)}
								<tr data-kind={row.kind}>
									<td class="font-semibold">{INSTALLMENT_LABEL[row.kind]}</td>
									<td>
										{#if row.kind === 'dp'}
											<span class="text-ink-2">Sebelum Booked</span>
										{:else if row.dueDate}
											{dateID(row.dueDate)}
											<span class="block text-small text-ink-2">Hari H</span>
										{:else}
											<span class="text-ink-2">Menunggu tanggal sesi</span>
										{/if}
									</td>
									<td
										class={[
											'text-right tabular-nums',
											row.cancelledAt && 'text-ink-2 line-through'
										]}>{rupiah(row.amount)}</td
									>
									<td><span class="chip {status.tone}">{status.label}</span></td>
									<td>
										{#if inv}
											{#if data.allow.invoices.read}
												<a
													class="underline-offset-2 hover:underline"
													href={resolve('/admin/(app)/keuangan/invoice/[id]', { id: inv.id })}
													>{inv.number}</a
												>
											{:else}{inv.number}{/if}
										{:else if canBill(row)}
											<button
												type="button"
												class="btn btn--secondary"
												onclick={() => openInstallmentInvoice(row)}
												aria-label="Buat invoice {INSTALLMENT_LABEL[row.kind]}">Buat invoice</button
											>
										{:else}<span class="text-ink-2">–</span>{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="text-small text-ink-2">
					DP {DP_PERCENT}% tetap dari harga disepakati; pelunasan jatuh tempo di Hari H dan ikut
					berubah bila harga atau tanggal sesi berubah.
				</p>

				<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-semibold">Pembayaran masuk</h3>
					{#if data.allow.payments && b.stage !== 'lost'}
						<button type="button" class="btn btn--primary" onclick={() => (paymentOpen = true)}>
							<Plus size={16} aria-hidden="true" /> Catat pembayaran
						</button>
					{/if}
				</div>
				{#if data.payments.length === 0}
					<p class="text-body text-ink-2">Belum ada pembayaran.</p>
				{:else}
					<div class="card table-wrap">
						<table class="table" aria-label="Pembayaran booking">
							<thead>
								<tr>
									<th scope="col">Kwitansi</th>
									<th scope="col">Tanggal</th>
									<th scope="col">Untuk</th>
									<th scope="col">Metode</th>
									<th scope="col" class="text-right">Jumlah</th>
									<th scope="col"><span class="sr-only">Aksi</span></th>
								</tr>
							</thead>
							<tbody>
								{#each data.payments as pay (pay.id)}
									<tr>
										<td class="font-semibold whitespace-nowrap">{pay.receiptNumber}</td>
										<td class="whitespace-nowrap">{dateID(pay.paidOn)}</td>
										<td>
											{pay.installmentKind
												? INSTALLMENT_LABEL[pay.installmentKind]
												: 'Invoice lain'}
											{#if pay.invoiceNumber}<span class="block text-small text-ink-2"
													>{pay.invoiceNumber}</span
												>{/if}
										</td>
										<td>{PAYMENT_METHOD_LABEL[pay.method]}</td>
										<td class="text-right tabular-nums">{rupiah(pay.amount)}</td>
										<td class="text-right whitespace-nowrap">
											<a
												class="icon-btn"
												href={resolve('/admin/(app)/keuangan/pembayaran/[id]/kwitansi', {
													id: pay.id
												})}
												download
												aria-label="Unduh kwitansi {pay.receiptNumber}"
											>
												<FileDown size={16} aria-hidden="true" />
											</a>
											{#if pay.proofMediaId}
												<!-- eslint-disable svelte/no-navigation-without-resolve -- API route that redirects to a presigned file URL -->
												<a
													class="icon-btn"
													href="/admin/api/payment-proofs/{pay.proofMediaId}/file"
													target="_blank"
													rel="noopener noreferrer"
													aria-label="Lihat bukti {pay.receiptNumber}"
												>
													<ImageIcon size={16} aria-hidden="true" />
												</a>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{/if}
											{#if data.allow.deletePayments}
												<button
													type="button"
													class="icon-btn"
													aria-label="Hapus {pay.receiptNumber}"
													onclick={() => {
														deletingPayment = pay;
														deletePaymentOpen = true;
													}}
												>
													<Trash2 size={16} aria-hidden="true" />
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-semibold">Invoice</h3>
					{#if data.allow.invoices.create && b.stage !== 'lost'}
						<button type="button" class="btn btn--secondary" onclick={() => (customOpen = true)}>
							<Plus size={16} aria-hidden="true" /> Invoice lain
						</button>
					{/if}
				</div>
				{#if data.invoices.length === 0}
					<p class="text-body text-ink-2">Belum ada invoice.</p>
				{:else}
					<div class="card table-wrap">
						<table class="table" aria-label="Invoice booking">
							<thead>
								<tr>
									<th scope="col">Nomor</th>
									<th scope="col">Termin</th>
									<th scope="col">Jatuh tempo</th>
									<th scope="col" class="text-right">Total</th>
									<th scope="col">Status</th>
								</tr>
							</thead>
							<tbody>
								{#each data.invoices as inv (inv.id)}
									<tr>
										<td class="whitespace-nowrap">
											{#if data.allow.invoices.read}
												<a
													class="font-semibold underline-offset-2 hover:underline"
													href={resolve('/admin/(app)/keuangan/invoice/[id]', { id: inv.id })}
													>{inv.number}</a
												>
											{:else}<span class="font-semibold">{inv.number}</span>{/if}
										</td>
										<td
											>{inv.installmentKind
												? INSTALLMENT_LABEL[inv.installmentKind]
												: 'Lainnya'}</td
										>
										<td class="whitespace-nowrap">{dateID(inv.dueDate)}</td>
										<td class="text-right tabular-nums">{rupiah(inv.total)}</td>
										<td
											><span class="chip {invoiceTone(inv.status)}"
												>{INVOICE_STATUS_LABEL[inv.status]}</span
											></td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="costs-title">
				<h2 id="costs-title" class="font-display text-section-title">Biaya</h2>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<p class="text-small text-ink-2">
						Biaya langsung booking ini: kru, transport, sewa alat.
					</p>
					{#if data.allow.expenses.create}
						<button type="button" class="btn btn--secondary" onclick={() => openExpense(null)}>
							<Plus size={16} aria-hidden="true" /> Tambah biaya
						</button>
					{/if}
				</div>
				{#if data.expenses.length === 0}
					<p class="text-body text-ink-2">Belum ada biaya.</p>
				{:else}
					<div class="card table-wrap">
						<table class="table" aria-label="Biaya booking">
							<thead>
								<tr>
									<th scope="col">Tanggal</th>
									<th scope="col">Kategori</th>
									<th scope="col" class="text-right">Jumlah</th>
									<th scope="col"><span class="sr-only">Aksi</span></th>
								</tr>
							</thead>
							<tbody>
								{#each data.expenses as e (e.id)}
									<tr>
										<td class="whitespace-nowrap">{dateID(e.spentOn)}</td>
										<td>
											{e.categoryName}
											{#if e.description}<span class="block text-small text-ink-2"
													>{e.description}</span
												>{/if}
										</td>
										<td class="text-right tabular-nums">{rupiah(e.amount)}</td>
										<td class="text-right whitespace-nowrap">
											{#if e.receiptMediaId}
												<!-- eslint-disable svelte/no-navigation-without-resolve -- API route that redirects to a presigned file URL -->
												<a
													class="icon-btn"
													href="/admin/api/expense-receipts/{e.receiptMediaId}/file"
													target="_blank"
													rel="noopener noreferrer"
													aria-label="Lihat nota {e.categoryName} {dateID(e.spentOn)}"
												>
													<ImageIcon size={16} aria-hidden="true" />
												</a>
												<!-- eslint-enable svelte/no-navigation-without-resolve -->
											{/if}
											{#if data.allow.expenses.update}
												<button
													type="button"
													class="icon-btn"
													aria-label="Ubah biaya {e.categoryName} {dateID(e.spentOn)}"
													onclick={() => openExpense(e)}
												>
													<Pencil size={16} aria-hidden="true" />
												</button>
											{/if}
											{#if data.allow.expenses.delete}
												<button
													type="button"
													class="icon-btn"
													aria-label="Hapus biaya {e.categoryName} {dateID(e.spentOn)}"
													onclick={() => {
														deletingExpense = e;
														deleteExpenseOpen = true;
													}}
												>
													<Trash2 size={16} aria-hidden="true" />
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="delivery-title">
				<h2 id="delivery-title" class="font-display text-section-title">Pengiriman</h2>
				{#if data.allow.update}
					<form
						method="post"
						action="?/delivery"
						class="card flex flex-col gap-3 px-4 py-3"
						novalidate
						use:enhance={() => {
							deliveryBusy = true;
							return async ({ result, update }) => {
								deliveryBusy = false;
								if (result.type === 'failure') {
									deliveryErrors = (result.data?.fields ?? {}) as Record<string, string>;
									toast.error(String(result.data?.error ?? 'Periksa lagi isian pengiriman.'));
									return;
								}
								if (result.type !== 'success') return;
								deliveryErrors = {};
								await update({ reset: false });
								toast.success(String(result.data?.done));
							};
						}}
					>
						<input type="hidden" name="id" value={b.id} />
						<div class="field">
							<label for="delivery-link">Link hasil (Google Drive)</label>
							<input
								id="delivery-link"
								name="deliveryLink"
								type="url"
								class="input"
								placeholder="https://drive.google.com/…"
								defaultValue={b.deliveryLink ?? ''}
								aria-invalid={deliveryErrors.deliveryLink ? 'true' : undefined}
								aria-describedby={deliveryErrors.deliveryLink ? 'delivery-link-error' : undefined}
							/>
							{#if deliveryErrors.deliveryLink}<p id="delivery-link-error" class="field__error">
									{deliveryErrors.deliveryLink}
								</p>{/if}
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="field">
								<label for="raw-delivered">Raw dikirim</label>
								<input
									id="raw-delivered"
									name="rawDeliveredOn"
									type="date"
									class="input"
									defaultValue={b.rawDeliveredOn ?? ''}
								/>
							</div>
							<div class="field">
								<label for="edited-delivered">Edited dikirim</label>
								<input
									id="edited-delivered"
									name="editedDeliveredOn"
									type="date"
									class="input"
									defaultValue={b.editedDeliveredOn ?? ''}
								/>
							</div>
						</div>
						<div class="flex flex-wrap items-center justify-between gap-2">
							{#if b.deliveryLink}
								<!-- eslint-disable svelte/no-navigation-without-resolve -- external delivery link -->
								<a
									class="inline-flex items-center gap-1.5 text-small underline-offset-2 hover:underline"
									href={b.deliveryLink}
									target="_blank"
									rel="noopener noreferrer"
								>
									<ExternalLink size={14} aria-hidden="true" /> Buka link hasil
								</a>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							{:else}<span></span>{/if}
							<button type="submit" class="btn btn--secondary" disabled={deliveryBusy}>
								{deliveryBusy ? 'Menyimpan…' : 'Simpan pengiriman'}
							</button>
						</div>
					</form>
				{:else}
					<dl class="card grid gap-2 px-4 py-3 text-body sm:grid-cols-3">
						<div>
							<dt class="text-small text-ink-2">Link hasil</dt>
							<dd class="break-all">{b.deliveryLink ?? '–'}</dd>
						</div>
						<div>
							<dt class="text-small text-ink-2">Raw dikirim</dt>
							<dd>{b.rawDeliveredOn ? dateID(b.rawDeliveredOn) : '–'}</dd>
						</div>
						<div>
							<dt class="text-small text-ink-2">Edited dikirim</dt>
							<dd>{b.editedDeliveredOn ? dateID(b.editedDeliveredOn) : '–'}</dd>
						</div>
					</dl>
				{/if}
			</section>

			{#if b.notes || b.inquiryMessage}
				<section class="flex flex-col gap-3" aria-labelledby="notes-title">
					<h2 id="notes-title" class="font-display text-section-title">Catatan</h2>
					{#if b.inquiryMessage}
						<div class="card px-4 py-3">
							<p class="text-small font-semibold text-ink-2">Pesan dari formulir website</p>
							<p class="mt-1 text-body whitespace-pre-line">{b.inquiryMessage}</p>
						</div>
					{/if}
					{#if b.notes}<p class="card px-4 py-3 text-body whitespace-pre-line">{b.notes}</p>{/if}
				</section>
			{/if}
		</div>

		<!-- Side column -->
		<div class="flex min-w-0 flex-col gap-6">
			<section class="flex flex-col gap-3" aria-labelledby="summary-title">
				<h2 id="summary-title" class="font-display text-section-title">Ringkasan</h2>
				<dl class="card divide-y divide-line text-body">
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Harga</dt>
						<dd class="tabular-nums">{rupiah(b.agreedPrice)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Dibayar</dt>
						<dd class="tabular-nums">{rupiah(paid)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Sisa</dt>
						<dd class="tabular-nums">{rupiah(b.stage === 'lost' ? 0 : b.agreedPrice - paid)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Biaya</dt>
						<dd class="tabular-nums">{rupiah(costs)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5 font-semibold">
						<dt>Laba</dt>
						<dd class="tabular-nums">{rupiah(paid - costs)}</dd>
					</div>
				</dl>
				<p class="text-small text-ink-2">Laba = pembayaran masuk − biaya.</p>
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="activity-title">
				<h2 id="activity-title" class="font-display text-section-title">Aktivitas</h2>
				{#if data.allow.update}
					<form
						method="post"
						action="?/activity"
						class="card flex flex-col gap-3 px-4 py-3"
						novalidate
						use:enhance={({ cancel }) => {
							if (!noteBody.trim()) {
								noteError = 'Tulis isi catatan.';
								cancel();
								return;
							}
							noteBusy = true;
							return async ({ result, update }) => {
								noteBusy = false;
								if (result.type === 'failure') {
									const fields = (result.data?.fields ?? {}) as Record<string, string>;
									noteError = fields.body ?? String(result.data?.error ?? 'Gagal menyimpan.');
									return;
								}
								if (result.type !== 'success') return;
								noteBody = '';
								noteError = '';
								await update({ reset: false });
								toast.success(String(result.data?.done));
							};
						}}
					>
						<input type="hidden" name="bookingId" value={b.id} />
						<div class="field">
							<label for="activity-type">Jenis</label>
							<select id="activity-type" name="type" class="input" bind:value={noteType}>
								{#each MANUAL_ACTIVITY_TYPES as t (t)}
									<option value={t}>{ACTIVITY_LABEL[t]}</option>
								{/each}
							</select>
						</div>
						<div class="field">
							<label for="activity-body">Isi</label>
							<textarea
								id="activity-body"
								name="body"
								class="input min-h-24"
								maxlength="2000"
								placeholder="Mis. sudah kirim pricelist, klien minta jadwal konsultasi Sabtu."
								bind:value={noteBody}
								oninput={() => (noteError = '')}
								aria-invalid={noteError ? 'true' : undefined}
								aria-describedby={noteError ? 'activity-body-error' : undefined}></textarea>
							{#if noteError}<p id="activity-body-error" class="field__error">{noteError}</p>{/if}
						</div>
						<div class="flex justify-end">
							<button type="submit" class="btn btn--primary" disabled={noteBusy}>
								{noteBusy ? 'Menyimpan…' : 'Simpan aktivitas'}
							</button>
						</div>
					</form>
				{/if}
				<ActivityTimeline items={data.activities} label="Aktivitas booking" />
			</section>
		</div>
	</div>
</div>

{#if data.allow.update && data.options}
	<BookingDrawer
		bind:open={editOpen}
		bookingId={b.id}
		options={data.options}
		allowNewClient={data.allow.newClient}
	/>
{/if}

<BookingMoveDialogs bind:this={dialogs} allowPayments={data.allow.payments} />

{#if data.allow.payments}
	<PaymentDrawer
		bind:open={paymentOpen}
		bookingId={b.id}
		onsaved={(r) => {
			if (r.dpPaid && data.allow.update) dpPaidOpen = true;
		}}
	/>
{/if}
<DpPaidModal bind:open={dpPaidOpen} bookingId={b.id} bookingTitle={b.title} />
<ConfirmDialog
	bind:open={deletePaymentOpen}
	title="Hapus pembayaran?"
	action="?/deletePayment"
	fields={{ id: deletingPayment?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	<strong>{deletingPayment?.receiptNumber}</strong> ({rupiah(deletingPayment?.amount ?? 0)}) dihapus
	dan status invoicenya dihitung ulang.
</ConfirmDialog>

{#if data.categories}
	<ExpenseDrawer
		bind:open={expenseOpen}
		expense={editingExpense}
		categories={data.categories}
		bookingId={b.id}
	/>
{/if}
<ConfirmDialog
	bind:open={deleteExpenseOpen}
	title="Hapus biaya?"
	action="?/deleteExpense"
	fields={{ id: deletingExpense?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	<strong>{deletingExpense?.categoryName}</strong>
	{rupiah(deletingExpense?.amount ?? 0)} dihapus dari booking ini.
</ConfirmDialog>

{#if data.allow.invoices.create}
	<InstallmentInvoiceModal
		bind:open={installmentOpen}
		installment={billing}
		bookingTitle={b.title}
	/>
	<CustomInvoiceDrawer bind:open={customOpen} bookingId={b.id} bookingTitle={b.title} />
{/if}
