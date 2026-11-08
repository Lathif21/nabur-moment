<script lang="ts">
	import { resolve } from '$app/paths';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import DpPaidModal from '#lib/components/finance/DpPaidModal.svelte';
	import PaymentDrawer from '#lib/components/finance/PaymentDrawer.svelte';
	import { INSTALLMENT_LABEL, PAYMENT_METHOD_LABEL } from '#lib/finance.ts';
	import { dateID, rupiah } from '#lib/format.ts';
	import { PAYMENT_METHODS } from '#lib/schemas/finance.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.rows)[number];

	// Opened straight away when the page comes from "Catat pembayaran DP" (?booking=…)
	let drawerOpen = $state(false);
	let preselect = $state<string | null>(null);
	$effect(() => {
		if (data.preselect && data.allow.create) {
			preselect = data.preselect;
			drawerOpen = true;
		}
	});
	function openNew() {
		preselect = null;
		drawerOpen = true;
	}

	let dpOpen = $state(false);
	let dpBooking = $state({ id: '', title: '' });
	function onsaved(r: { dpPaid: boolean; bookingId: string }) {
		if (!r.dpPaid || !data.allow.bookings) return;
		dpBooking = {
			id: r.bookingId,
			title: data.bookings?.find((b) => b.id === r.bookingId)?.title ?? ''
		};
		dpOpen = true;
	}

	let deleting = $state<Row | null>(null);
	let deleteOpen = $state(false);

	const submitOnChange = (e: Event & { currentTarget: HTMLSelectElement | HTMLInputElement }) =>
		e.currentTarget.form?.requestSubmit();
</script>

<div class="page-body">
	<PageHeader
		title="Pembayaran"
		description="{data.rows.length} pembayaran · {rupiah(data.total)}{data.filter.month
			? ''
			: ' (semua waktu)'}"
	>
		{#snippet actions()}
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={openNew}>
					<Plus size={16} aria-hidden="true" /> Catat pembayaran
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<form method="get" class="flex flex-wrap items-end gap-3" data-sveltekit-keepfocus>
		<div class="field min-w-56 flex-1">
			<label for="pay-q">Cari</label>
			<input
				id="pay-q"
				name="q"
				type="search"
				class="input"
				placeholder="Kwitansi, invoice, klien, atau booking"
				defaultValue={data.filter.q}
			/>
		</div>
		<div class="field">
			<label for="pay-month">Bulan bayar</label>
			<input
				id="pay-month"
				name="bulan"
				type="month"
				class="input"
				defaultValue={data.filter.month ?? ''}
				onchange={submitOnChange}
			/>
		</div>
		<div class="field">
			<label for="pay-method-filter">Metode</label>
			<select
				id="pay-method-filter"
				name="metode"
				class="input"
				value={data.filter.method ?? ''}
				onchange={submitOnChange}
			>
				<option value="">Semua metode</option>
				{#each PAYMENT_METHODS as m (m)}<option value={m}>{PAYMENT_METHOD_LABEL[m]}</option>{/each}
			</select>
		</div>
		<button type="submit" class="btn btn--secondary">Cari</button>
	</form>

	{#if data.rows.length === 0}
		<EmptyState message="Belum ada pembayaran yang cocok." />
	{:else}
		<section class="card table-wrap">
			<table class="table" aria-label="Daftar pembayaran">
				<thead>
					<tr>
						<th scope="col">Kwitansi</th>
						<th scope="col">Tanggal</th>
						<th scope="col">Booking</th>
						<th scope="col">Untuk</th>
						<th scope="col">Metode</th>
						<th scope="col" class="text-right">Jumlah</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as r (r.id)}
						<tr>
							<td class="font-semibold whitespace-nowrap">{r.receiptNumber}</td>
							<td class="whitespace-nowrap">{dateID(r.paidOn)}</td>
							<td>
								{#if data.allow.bookings}
									<a
										class="underline-offset-2 hover:underline"
										href={resolve('/admin/(app)/booking/[id]', { id: r.bookingId })}
										>{r.bookingTitle}</a
									>
								{:else}{r.bookingTitle}{/if}
								<span class="block text-small text-ink-2">{r.clientName}</span>
							</td>
							<td>
								{r.installmentKind ? INSTALLMENT_LABEL[r.installmentKind] : 'Invoice lain'}
								{#if r.invoiceNumber}<span class="block text-small text-ink-2"
										>{r.invoiceNumber}</span
									>{/if}
							</td>
							<td>{PAYMENT_METHOD_LABEL[r.method]}</td>
							<td class="text-right tabular-nums">{rupiah(r.amount)}</td>
							<td class="text-right whitespace-nowrap">
								{#if r.proofMediaId}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- API route that redirects to a presigned file URL -->
									<a
										class="icon-btn"
										href="/admin/api/payment-proofs/{r.proofMediaId}/file"
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Lihat bukti {r.receiptNumber}"
									>
										<ImageIcon size={16} aria-hidden="true" />
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{/if}
								{#if data.allow.delete}
									<button
										type="button"
										class="icon-btn"
										aria-label="Hapus {r.receiptNumber}"
										onclick={() => {
											deleting = r;
											deleteOpen = true;
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
		</section>
	{/if}
</div>

{#if data.allow.create && data.bookings}
	<PaymentDrawer bind:open={drawerOpen} bookings={data.bookings} bookingId={preselect} {onsaved} />
{/if}

<DpPaidModal bind:open={dpOpen} bookingId={dpBooking.id} bookingTitle={dpBooking.title} />

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus pembayaran?"
	action="?/delete"
	fields={{ id: deleting?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	<strong>{deleting?.receiptNumber}</strong> ({rupiah(deleting?.amount ?? 0)}) dihapus dan status
	invoicenya dihitung ulang. Nomor kwitansinya tidak dipakai lagi.
</ConfirmDialog>
