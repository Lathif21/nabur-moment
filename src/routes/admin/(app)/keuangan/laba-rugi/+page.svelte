<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import StatTile from '#lib/components/admin/StatTile.svelte';
	import { monthLabel } from '#lib/calendar.ts';
	import { dayKeyWib, rupiah, rupiahShort } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = resolve('admin/keuangan/laba-rugi');
	const dashboard = resolve('admin');
	/** Months after the current one have no data yet */
	const future = (month: string) => data.year === data.thisYear && month > dayKeyWib().slice(0, 7);
</script>

<div class="page-body">
	<PageHeader title="Laba Rugi" description="Pemasukan dan pengeluaran per bulan, tanpa pajak." />

	<nav class="flex items-center gap-1" aria-label="Pilih tahun">
		<a class="icon-btn" href="{base}?tahun={data.year - 1}" aria-label="Tahun sebelumnya">
			<ChevronLeft size={16} aria-hidden="true" />
		</a>
		<h2 class="min-w-24 text-center font-display text-section-title" aria-live="polite">
			{data.year}
		</h2>
		{#if data.year > data.thisYear}
			<span
				class="icon-btn opacity-40"
				role="link"
				aria-disabled="true"
				aria-label="Tahun berikutnya"
			>
				<ChevronRight size={16} aria-hidden="true" />
			</span>
		{:else}
			<a class="icon-btn" href="{base}?tahun={data.year + 1}" aria-label="Tahun berikutnya">
				<ChevronRight size={16} aria-hidden="true" />
			</a>
		{/if}
	</nav>

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Pemasukan" value={rupiahShort(data.total.income)} note="Pembayaran masuk" />
		<StatTile label="Biaya langsung" value={rupiahShort(data.total.direct)} note="Per booking" />
		<StatTile label="Overhead" value={rupiahShort(data.total.overhead)} note="Tanpa booking" />
		<StatTile
			label="Laba bersih"
			value={rupiahShort(data.total.profit)}
			note="Tahun {data.year}"
			variant="dark"
		/>
	</div>

	<section class="card table-wrap">
		<table class="table" aria-label="Laba rugi {data.year} per bulan">
			<thead>
				<tr>
					<th scope="col">Bulan</th>
					<th scope="col" class="text-right">Pemasukan</th>
					<th scope="col" class="text-right">Biaya langsung</th>
					<th scope="col" class="text-right">Overhead</th>
					<th scope="col" class="text-right">Laba bersih</th>
				</tr>
			</thead>
			<tbody>
				{#each data.months as m (m.month)}
					<tr class={future(m.month) ? 'text-ink-2' : undefined} data-month={m.month}>
						<th scope="row" class="text-left font-normal">{monthLabel(m.month)}</th>
						<td class="text-right tabular-nums">{rupiah(m.income)}</td>
						<td class="text-right tabular-nums">{rupiah(m.direct)}</td>
						<td class="text-right tabular-nums">{rupiah(m.overhead)}</td>
						<td class={['text-right font-semibold tabular-nums', m.profit < 0 && 'text-danger']}
							>{rupiah(m.profit)}</td
						>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr class="font-semibold" data-month="total">
					<th scope="row" class="text-left">Total {data.year}</th>
					<td class="text-right tabular-nums">{rupiah(data.total.income)}</td>
					<td class="text-right tabular-nums">{rupiah(data.total.direct)}</td>
					<td class="text-right tabular-nums">{rupiah(data.total.overhead)}</td>
					<td class={['text-right tabular-nums', data.total.profit < 0 && 'text-danger']}
						>{rupiah(data.total.profit)}</td
					>
				</tr>
			</tfoot>
		</table>
	</section>

	<p class="text-small text-ink-2">
		Pemasukan dihitung dari tanggal bayar, pengeluaran dari tanggal pengeluaran. Angka tahunan sama
		dengan <a
			class="underline underline-offset-2"
			href="{dashboard}?period=year&from={data.year}-01-01">Dashboard Tahunan {data.year}</a
		>.
	</p>
</div>
