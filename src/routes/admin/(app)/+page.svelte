<script lang="ts">
	import { resolve } from '$app/paths';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import MoneyChart from '#lib/components/admin/MoneyChart.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import PeriodFilter from '#lib/components/admin/PeriodFilter.svelte';
	import StatTile from '#lib/components/admin/StatTile.svelte';
	import { ADMIN_EVENT_LABEL } from '#lib/crm.ts';
	import { INVOICE_STATUS_LABEL, invoiceTone } from '#lib/finance.ts';
	import { countdown, dateID, rupiah, rupiahShort } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const m = $derived(data.money);
	const d = (pct: number | null, upIsGood: boolean) =>
		pct === null ? undefined : { pct, upIsGood };
	const pipelineMax = $derived(Math.max(1, ...data.pipeline.map((s) => s.n)));
	const base = resolve('admin');
</script>

<div class="page-body">
	<PageHeader
		title="Dashboard"
		description={m ? `Ringkasan ${data.period.label}.` : 'Ringkasan booking dan acara.'}
	/>

	{#if m}
		<PeriodFilter value={data.period} {base} />

		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4" role="group" aria-label="Ringkasan keuangan">
			<StatTile
				label="Pemasukan"
				value={rupiahShort(m.now.income)}
				delta={d(m.deltas.income, true)}
				note="Belum ada data pembanding"
			/>
			<StatTile
				label="Pengeluaran"
				value={rupiahShort(m.now.expenses)}
				delta={d(m.deltas.expenses, false)}
				note="Belum ada data pembanding"
			/>
			<StatTile
				label="Laba bersih"
				value={rupiahShort(m.now.profit)}
				delta={d(m.deltas.profit, true)}
				note="Pemasukan − pengeluaran"
				variant="dark"
			/>
			<StatTile
				label="Piutang"
				value={rupiahShort(m.owed)}
				delta={d(m.deltas.owed, false)}
				note="Sisa tagihan booking aktif"
			/>
		</div>

		<section class="card flex flex-col gap-3 p-4" aria-labelledby="chart-title">
			<h2 id="chart-title" class="font-display text-section-title">Pemasukan vs Pengeluaran</h2>
			<MoneyChart
				points={m.series}
				bucket={data.period.bucket}
				label="Pemasukan dan pengeluaran per periode"
			/>
		</section>
	{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="flex flex-col gap-3" aria-labelledby="upcoming-title">
			<h2 id="upcoming-title" class="font-display text-section-title">Acara 30 hari ke depan</h2>
			{#if data.upcoming.length === 0}
				<EmptyState message="Tidak ada acara dalam 30 hari ke depan." />
			{:else}
				<ul class="card divide-y divide-line">
					{#each data.upcoming as s (s.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
							<div class="min-w-0">
								<p class="font-semibold">
									{#if data.allow.bookings}
										<a
											class="underline-offset-2 hover:underline"
											href={resolve('/admin/(app)/booking/[id]', { id: s.bookingId })}>{s.title}</a
										>
									{:else}{s.title}{/if}
								</p>
								<p class="text-small text-ink-2">
									{ADMIN_EVENT_LABEL[s.eventType]} · {dateID(s.date!, 'long')}{s.startTime
										? ` · ${s.startTime}`
										: ''} · {s.clientName}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-small font-semibold">{countdown(s.date!, data.today)}</span>
								{#if s.bookedAt}<span class="chip chip--success">DP lunas</span>{:else}<span
										class="chip chip--warning">Belum DP</span
									>{/if}
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if data.allow.invoices}
			<section class="flex flex-col gap-3" aria-labelledby="due-title">
				<h2 id="due-title" class="font-display text-section-title">
					Invoice jatuh tempo / terlambat
				</h2>
				{#if data.invoices.length === 0}
					<EmptyState message="Tidak ada invoice yang jatuh tempo minggu ini." />
				{:else}
					<ul class="card divide-y divide-line">
						{#each data.invoices as inv (inv.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
								<div class="min-w-0">
									<a
										class="font-semibold underline-offset-2 hover:underline"
										href={resolve('/admin/(app)/keuangan/invoice/[id]', { id: inv.id })}
										>{inv.number}</a
									>
									<p class="text-small text-ink-2">
										{inv.bookingTitle} · jatuh tempo {dateID(inv.dueDate)}
									</p>
								</div>
								<div class="flex items-center gap-2">
									<span class="tabular-nums">{rupiah(Math.max(0, inv.total - inv.paid))}</span>
									<span class="chip {invoiceTone(inv.status)}"
										>{INVOICE_STATUS_LABEL[inv.status]}</span
									>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<section class="flex flex-col gap-3" aria-labelledby="pipeline-title">
			<h2 id="pipeline-title" class="font-display text-section-title">Ringkasan pipeline</h2>
			<ul class="card flex flex-col gap-2 p-4" aria-label="Jumlah booking per tahap">
				{#each data.pipeline as s (s.stage)}
					<li class="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-body">
						<span>{s.label}</span>
						<span class="h-2 rounded-chip bg-sage-20" aria-hidden="true">
							<span
								class="block h-2 rounded-chip bg-olive"
								style:width="{(s.n / pipelineMax) * 100}%"
							></span>
						</span>
						<span class="text-right font-semibold tabular-nums">{s.n}</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-3" aria-labelledby="inquiry-title">
			<h2 id="inquiry-title" class="font-display text-section-title">Inquiry baru</h2>
			{#if data.inquiries.length === 0}
				<EmptyState message="Belum ada inquiry baru." />
			{:else}
				<ul class="card divide-y divide-line">
					{#each data.inquiries as q (q.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
							<div class="min-w-0">
								<p class="font-semibold">
									{#if data.allow.bookings}
										<a
											class="underline-offset-2 hover:underline"
											href={resolve('/admin/(app)/booking/[id]', { id: q.id })}>{q.title}</a
										>
									{:else}{q.title}{/if}
								</p>
								<p class="text-small text-ink-2">{q.clientName}</p>
							</div>
							<span class="text-small text-ink-2"
								>{q.origin === 'website_form' ? 'Formulir website' : 'Manual'} · {dateID(
									q.createdAt
								)}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>
