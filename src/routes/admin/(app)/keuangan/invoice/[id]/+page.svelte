<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileDown from '@lucide/svelte/icons/file-down';
	import Ban from '@lucide/svelte/icons/ban';
	import Send from '@lucide/svelte/icons/send';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import { refreshThenToast } from '#lib/enhance.ts';
	import {
		INSTALLMENT_LABEL,
		INVOICE_STATUS_LABEL,
		PAYMENT_METHOD_LABEL,
		invoiceTone,
		itemsTotal
	} from '#lib/finance.ts';
	import { dateID, rupiah } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const inv = $derived(data.invoice);
	const subtotal = $derived(itemsTotal(inv.items));
	/** Installment invoice: the lines are the contract, the total is the installment billed */
	const isInstallment = $derived(!!inv.installmentKind && subtotal !== inv.total);
	const outstanding = $derived(inv.status === 'void' ? 0 : Math.max(0, inv.total - inv.paid));
	let voidOpen = $state(false);
	let sending = $state(false);
</script>

<div class="page-body">
	<a
		class="inline-flex items-center gap-1.5 text-small text-ink-2 hover:underline"
		href={resolve('admin/keuangan/invoice')}
	>
		<ArrowLeft size={14} aria-hidden="true" /> Semua invoice
	</a>

	<PageHeader
		title={inv.number}
		description="{inv.installmentKind
			? INSTALLMENT_LABEL[inv.installmentKind]
			: 'Invoice lain'} · {inv.client.name}"
	>
		{#snippet actions()}
			{#if data.allow.update && inv.status === 'draft'}
				<form
					method="post"
					action="?/sent"
					use:enhance={refreshThenToast({
						start: () => (sending = true),
						end: () => (sending = false)
					})}
				>
					<input type="hidden" name="id" value={inv.id} />
					<button type="submit" class="btn btn--primary" disabled={sending}>
						<Send size={16} aria-hidden="true" />
						{sending ? 'Menyimpan…' : 'Tandai terkirim'}
					</button>
				</form>
			{/if}
			{#if data.allow.void && inv.status !== 'void' && inv.payments.length === 0}
				<button type="button" class="btn btn--ghost" onclick={() => (voidOpen = true)}>
					<Ban size={16} aria-hidden="true" /> Batalkan (void)
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-body">
		<span class="chip {invoiceTone(inv.status)}" data-testid="invoice-status"
			>{INVOICE_STATUS_LABEL[inv.status]}</span
		>
		<span>Tanggal {dateID(inv.issueDate)}</span>
		<span>Jatuh tempo <strong>{dateID(inv.dueDate)}</strong></span>
		{#if inv.sentAt}<span class="text-ink-2">Dikirim {dateID(inv.sentAt)}</span>{/if}
		{#if inv.voidedAt}<span class="text-ink-2">Dibatalkan {dateID(inv.voidedAt)}</span>{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<section class="flex min-w-0 flex-col gap-3" aria-labelledby="items-title">
			<h2 id="items-title" class="font-display text-section-title">Rincian</h2>
			<div class="card table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th scope="col">Keterangan</th>
							<th scope="col" class="text-right">Jumlah</th>
							<th scope="col" class="text-right">Harga</th>
							<th scope="col" class="text-right">Subtotal</th>
						</tr>
					</thead>
					<tbody>
						{#each inv.items as it, i (i)}
							<tr>
								<td>{it.description}</td>
								<td class="text-right tabular-nums">{it.qty}</td>
								<td class="text-right tabular-nums">{rupiah(it.unitPrice)}</td>
								<td class="text-right tabular-nums">{rupiah(it.qty * it.unitPrice)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						{#if isInstallment}
							<tr>
								<th scope="row" colspan="3" class="text-right font-normal">Nilai kontrak</th>
								<td class="text-right tabular-nums">{rupiah(subtotal)}</td>
							</tr>
							<tr>
								<th scope="row" colspan="3" class="text-right"
									>Ditagih: {INSTALLMENT_LABEL[inv.installmentKind!]}</th
								>
								<td class="text-right font-semibold tabular-nums" data-testid="invoice-total"
									>{rupiah(inv.total)}</td
								>
							</tr>
						{:else}
							<tr>
								<th scope="row" colspan="3" class="text-right">Total</th>
								<td class="text-right font-semibold tabular-nums" data-testid="invoice-total"
									>{rupiah(inv.total)}</td
								>
							</tr>
						{/if}
					</tfoot>
				</table>
			</div>
			{#if inv.notes}
				<p class="card px-4 py-3 text-body whitespace-pre-line">{inv.notes}</p>
			{/if}
			<div class="flex flex-wrap gap-2">
				<a
					class="btn btn--secondary"
					href={resolve('/admin/(app)/keuangan/invoice/[id]/pdf', { id: inv.id })}
					download
				>
					<FileDown size={16} aria-hidden="true" /> Unduh PDF
				</a>
				<a
					class="btn btn--ghost"
					href="{resolve('/admin/(app)/keuangan/invoice/[id]/pdf', { id: inv.id })}?view"
					target="_blank"
					rel="noopener">Lihat PDF</a
				>
			</div>
		</section>

		<div class="flex min-w-0 flex-col gap-6">
			<section class="flex flex-col gap-3" aria-labelledby="bill-title">
				<h2 id="bill-title" class="font-display text-section-title">Tagihan</h2>
				<dl class="card divide-y divide-line text-body">
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Booking</dt>
						<dd class="text-right">
							{#if data.allow.booking}
								<a
									class="underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/booking/[id]', { id: inv.booking.id })}
									>{inv.booking.title}</a
								>
							{:else}{inv.booking.title}{/if}
						</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Total</dt>
						<dd class="tabular-nums">{rupiah(inv.total)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5">
						<dt>Dibayar</dt>
						<dd class="tabular-nums">{rupiah(inv.paid)}</dd>
					</div>
					<div class="flex justify-between gap-3 px-4 py-2.5 font-semibold">
						<dt>Sisa</dt>
						<dd class="tabular-nums">{rupiah(outstanding)}</dd>
					</div>
				</dl>
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="pay-title">
				<h2 id="pay-title" class="font-display text-section-title">Pembayaran</h2>
				{#if inv.payments.length === 0}
					<p class="text-body text-ink-2">Belum ada pembayaran.</p>
				{:else}
					<ul class="card divide-y divide-line">
						{#each inv.payments as p (p.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
								<span>
									<span class="block font-semibold">{p.receiptNumber}</span>
									<span class="text-small text-ink-2"
										>{dateID(p.paidOn)} · {PAYMENT_METHOD_LABEL[p.method]}</span
									>
								</span>
								<span class="tabular-nums">{rupiah(p.amount)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={voidOpen}
	title="Batalkan invoice?"
	action="?/void"
	fields={{ id: inv.id }}
	confirmLabel="Batalkan invoice"
	tone="danger"
>
	<strong>{inv.number}</strong> tetap tersimpan dengan nomornya tetapi tidak lagi ditagihkan. Termin ini
	bisa dibuatkan invoice baru.
</ConfirmDialog>
