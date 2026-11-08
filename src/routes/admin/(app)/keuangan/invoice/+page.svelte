<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import {
		INSTALLMENT_LABEL,
		INVOICE_STATUSES,
		INVOICE_STATUS_LABEL,
		invoiceTone
	} from '#lib/finance.ts';
	import { dateID, rupiah } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const listHref = resolve('admin/keuangan/invoice');
	/** Status chip links keep the search and the month */
	function statusQuery(status: string | null) {
		const parts: string[] = [];
		if (data.filter.q) parts.push(`q=${encodeURIComponent(data.filter.q)}`);
		if (data.filter.month) parts.push(`bulan=${data.filter.month}`);
		if (status) parts.push(`status=${status}`);
		return parts.length ? `?${parts.join('&')}` : '';
	}
	const allCount = $derived(Object.values(data.counts).reduce((s, n) => s + (n ?? 0), 0));
	const submitOnChange = (e: Event & { currentTarget: HTMLInputElement }) =>
		e.currentTarget.form?.requestSubmit();
</script>

<div class="page-body">
	<PageHeader
		title="Invoice"
		description="Invoice dibuat dari halaman booking (tombol Buat invoice di bagian Pembayaran)."
	/>

	<form method="get" class="flex flex-wrap items-end gap-3" data-sveltekit-keepfocus>
		{#if data.filter.status}<input type="hidden" name="status" value={data.filter.status} />{/if}
		<div class="field min-w-56 flex-1">
			<label for="inv-q">Cari</label>
			<input
				id="inv-q"
				name="q"
				type="search"
				class="input"
				placeholder="Nomor, klien, atau booking"
				defaultValue={data.filter.q}
			/>
		</div>
		<div class="field">
			<label for="inv-month">Bulan invoice</label>
			<input
				id="inv-month"
				name="bulan"
				type="month"
				class="input"
				defaultValue={data.filter.month ?? ''}
				onchange={submitOnChange}
			/>
		</div>
		<button type="submit" class="btn btn--secondary">Cari</button>
	</form>

	<nav class="flex flex-wrap gap-2" aria-label="Filter status">
		<a
			class={['chip', !data.filter.status && 'outline-2 outline-olive']}
			href="{listHref}{statusQuery(null)}"
			aria-current={!data.filter.status ? 'page' : undefined}>Semua · {allCount}</a
		>
		{#each INVOICE_STATUSES as s (s)}
			<a
				class={['chip', invoiceTone(s), data.filter.status === s && 'outline-2 outline-olive']}
				href="{listHref}{statusQuery(s)}"
				aria-current={data.filter.status === s ? 'page' : undefined}
				>{INVOICE_STATUS_LABEL[s]} · {data.counts[s] ?? 0}</a
			>
		{/each}
	</nav>

	{#if data.rows.length === 0}
		<EmptyState
			message={data.filter.q || data.filter.status || data.filter.month
				? 'Tidak ada invoice yang cocok.'
				: 'Belum ada invoice. Buat dari halaman booking.'}
		/>
	{:else}
		<section class="card table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th scope="col">Nomor</th>
						<th scope="col">Booking</th>
						<th scope="col">Termin</th>
						<th scope="col">Tanggal</th>
						<th scope="col">Jatuh tempo</th>
						<th scope="col" class="text-right">Total</th>
						<th scope="col">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as r (r.id)}
						<tr>
							<td class="whitespace-nowrap">
								<a
									class="font-semibold underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/keuangan/invoice/[id]', { id: r.id })}>{r.number}</a
								>
							</td>
							<td>
								<span class="block">{r.bookingTitle}</span>
								<span class="text-small text-ink-2">{r.clientName}</span>
							</td>
							<td>{r.installmentKind ? INSTALLMENT_LABEL[r.installmentKind] : 'Lainnya'}</td>
							<td class="whitespace-nowrap">{dateID(r.issueDate)}</td>
							<td class="whitespace-nowrap">{dateID(r.dueDate)}</td>
							<td class="text-right tabular-nums">
								{rupiah(r.total)}
								{#if r.paid > 0 && r.paid < r.total}<span class="block text-small text-ink-2"
										>dibayar {rupiah(r.paid)}</span
									>{/if}
							</td>
							<td
								><span class="chip {invoiceTone(r.status)}">{INVOICE_STATUS_LABEL[r.status]}</span
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>
