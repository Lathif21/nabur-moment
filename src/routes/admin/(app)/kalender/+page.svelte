<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import { WEEKDAYS_ID, monthLabel, shiftMonth } from '#lib/calendar.ts';
	import { EVENT_TYPES, EVENT_TYPE_LABEL, STAGE_LABEL, stageTone } from '#lib/crm.ts';
	import { dateID, rupiah } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Item = (typeof data.items)[number];

	const byDay = $derived.by(() => {
		const map: Record<string, Item[]> = {};
		for (const it of data.items) (map[it.date] ??= []).push(it);
		return map;
	});
	/** Agenda (phones): days of this month that have sessions */
	const agendaDays = $derived(
		Object.keys(byDay)
			.filter((d) => d.startsWith(data.month))
			.sort()
	);

	/** Keep the filters when changing month */
	const calendarHref = resolve('admin/kalender');
	function monthQuery(month: string) {
		let q = `?bulan=${month}`;
		if (data.filter.eventType) q += `&jenis=${data.filter.eventType}`;
		if (!data.filter.includeTentative) q += '&tentatif=0';
		return q;
	}

	const submitOnChange = (e: Event & { currentTarget: HTMLSelectElement | HTMLInputElement }) =>
		e.currentTarget.form?.requestSubmit();

	const chipText = (it: Item) =>
		[EVENT_TYPE_LABEL[it.eventType], it.title, it.startTime].filter(Boolean).join(' · ');

	// ---------- booking drawer ----------
	let selected = $state<Item | null>(null);
	let drawerOpen = $state(false);
	function show(it: Item) {
		selected = it;
		drawerOpen = true;
	}
	const siblings = $derived(
		selected ? data.items.filter((i) => i.bookingId === selected!.bookingId) : []
	);

	/**
	 * Fill = booked (DP paid), dashed outline = tentative. Colour by crew: 1 = emerald, 2 = burgundy;
	 * no crew keeps forest / olive.
	 */
	function tone(it: Item) {
		const n = it.crewCount;
		if (it.booked)
			return n === 1
				? 'border-crew-1 bg-crew-1 text-surface'
				: n >= 2
					? 'border-crew-2 bg-crew-2 text-surface'
					: 'border-forest bg-forest text-surface';
		return n === 1
			? 'border-2 border-dashed border-crew-1 bg-surface'
			: n >= 2
				? 'border-2 border-dashed border-crew-2 bg-surface'
				: 'border-dashed border-olive bg-surface';
	}
	const crewText = (it: Item) => (it.crewCount ? `${it.crewCount} kru` : 'belum ada kru');

	const time = (it: Item) =>
		it.startTime && it.endTime ? `${it.startTime}–${it.endTime}` : (it.startTime ?? null);
</script>

{#snippet chip(it: Item, full = false)}
	<button
		type="button"
		class={[
			'w-full rounded-chip border px-1.5 py-0.5 text-left text-[11px] leading-snug font-semibold',
			tone(it),
			full && 'px-3 py-2 text-small'
		]}
		data-status={it.booked ? 'booked' : 'tentative'}
		data-crew={it.crewCount}
		title={`${chipText(it)} · ${crewText(it)}${it.booked ? '' : ' (tentatif, belum DP)'}`}
		onclick={() => show(it)}
	>
		<span class="flex items-start justify-between gap-1">
			<span class={full ? undefined : 'line-clamp-2'}>{chipText(it)}</span>
			{#if it.crewCount}
				<!-- Visible count: emerald and burgundy look alike to some people -->
				<span class="shrink-0 tabular-nums opacity-90" aria-hidden="true">{it.crewCount}×</span>
			{/if}
		</span>
		<span class="sr-only">{it.booked ? ', booked' : ', tentatif'}, {crewText(it)}</span>
	</button>
{/snippet}

{#snippet busy(day: string)}
	{#if data.busyDays[day]}
		<span
			class="inline-flex items-center gap-1 rounded-chip bg-warning-bg px-1.5 text-[11px] font-semibold text-warning"
			title="{data.busyDays[day]} booking di tanggal ini"
			data-testid="busy-{day}"
		>
			<TriangleAlert size={12} aria-hidden="true" />
			{data.busyDays[day]}<span class="sr-only"> booking di tanggal ini</span>
		</span>
	{/if}
{/snippet}

<div class="page-body">
	<PageHeader
		title="Kalender"
		description="Sesi booking per tanggal. Penuh = Booked (DP lunas), garis putus = tentatif. Warna = jumlah kru."
	/>

	<div class="flex flex-wrap items-center justify-between gap-3">
		<nav class="flex items-center gap-1" aria-label="Pilih bulan">
			<a
				class="icon-btn"
				href="{calendarHref}{monthQuery(shiftMonth(data.month, -1))}"
				aria-label="Bulan sebelumnya"
			>
				<ChevronLeft size={18} aria-hidden="true" />
			</a>
			<h2 class="min-w-40 text-center font-display text-section-title" aria-live="polite">
				{monthLabel(data.month)}
			</h2>
			<a
				class="icon-btn"
				href="{calendarHref}{monthQuery(shiftMonth(data.month, 1))}"
				aria-label="Bulan berikutnya"
			>
				<ChevronRight size={18} aria-hidden="true" />
			</a>
			{#if data.month !== data.today.slice(0, 7)}
				<a class="btn btn--ghost" href="{calendarHref}{monthQuery(data.today.slice(0, 7))}"
					>Bulan ini</a
				>
			{/if}
		</nav>

		<form method="get" class="flex flex-wrap items-center gap-3" data-sveltekit-keepfocus>
			<input type="hidden" name="bulan" value={data.month} />
			<label class="sr-only" for="cal-jenis">Jenis sesi</label>
			<select
				id="cal-jenis"
				name="jenis"
				class="input w-auto!"
				value={data.filter.eventType ?? ''}
				onchange={submitOnChange}
			>
				<option value="">Semua jenis</option>
				{#each EVENT_TYPES as e (e.key)}<option value={e.key}>{e.label}</option>{/each}
			</select>
			<input type="hidden" name="tentatif" value="0" />
			<label class="inline-flex items-center gap-2 text-body">
				<input
					type="checkbox"
					name="tentatif"
					value="1"
					checked={data.filter.includeTentative}
					onchange={submitOnChange}
				/>
				Tampilkan tentatif
			</label>
			<noscript><button type="submit" class="btn btn--secondary">Terapkan</button></noscript>
		</form>
	</div>

	<!-- Month grid (tablet and up) -->
	<div class="hidden overflow-hidden rounded-card border border-line md:block">
		<div class="grid grid-cols-7 border-b border-line bg-sage-20" aria-hidden="true">
			{#each WEEKDAYS_ID as w (w)}
				<div class="px-2 py-1.5 text-small font-semibold text-ink-2">{w}</div>
			{/each}
		</div>
		<ol class="grid grid-cols-7" aria-label="Kalender {monthLabel(data.month)}">
			{#each data.weeks.flat() as day (day)}
				{@const inMonth = day.startsWith(data.month)}
				<li
					class={[
						'flex min-h-28 min-w-0 flex-col gap-1 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0',
						inMonth ? 'bg-surface' : 'bg-cream',
						data.busyDays[day] && 'bg-warning-bg/40'
					]}
					aria-label={dateID(day, 'long')}
					data-day={day}
				>
					<div class="flex items-center justify-between gap-1">
						<span
							class={[
								'inline-flex size-6 items-center justify-center rounded-full text-small',
								day === data.today ? 'bg-olive font-semibold text-surface' : '',
								!inMonth && 'text-ink-2'
							]}
							aria-current={day === data.today ? 'date' : undefined}>{Number(day.slice(8))}</span
						>
						{@render busy(day)}
					</div>
					{#each byDay[day] ?? [] as it (it.id)}{@render chip(it)}{/each}
				</li>
			{/each}
		</ol>
	</div>

	<!-- Agenda (phones) -->
	<div class="md:hidden">
		{#if agendaDays.length === 0}
			<EmptyState message="Tidak ada sesi di bulan ini." />
		{:else}
			<ol class="flex flex-col gap-4" aria-label="Agenda {monthLabel(data.month)}">
				{#each agendaDays as day (day)}
					<li class="flex flex-col gap-2">
						<h3 class="flex items-center gap-2 text-body font-semibold">
							{dateID(day, 'long')}
							{#if day === data.today}<span class="chip">Hari ini</span>{/if}
							{@render busy(day)}
						</h3>
						{#each byDay[day] as it (it.id)}{@render chip(it, true)}{/each}
					</li>
				{/each}
			</ol>
		{/if}
	</div>

	<ul class="flex flex-wrap gap-4 text-small text-ink-2" aria-label="Keterangan">
		<li class="inline-flex items-center gap-1.5">
			<span class="inline-block h-3 w-5 rounded-chip bg-forest" aria-hidden="true"></span> Warna penuh:
			Booked (DP lunas)
		</li>
		<li class="inline-flex items-center gap-1.5">
			<span
				class="inline-block h-3 w-5 rounded-chip border border-dashed border-olive"
				aria-hidden="true"
			></span> Garis putus: Tentatif (belum DP)
		</li>
		<li class="inline-flex items-center gap-1.5">
			<span class="inline-block h-3 w-5 rounded-chip bg-crew-1" aria-hidden="true"></span> Hijau: 1 kru
		</li>
		<li class="inline-flex items-center gap-1.5">
			<span class="inline-block h-3 w-5 rounded-chip bg-crew-2" aria-hidden="true"></span> Merah marun:
			2 kru
		</li>
		<li class="inline-flex items-center gap-1.5">
			<TriangleAlert size={14} class="text-warning" aria-hidden="true" /> 2+ booking di tanggal yang sama
		</li>
	</ul>
</div>

<Drawer bind:open={drawerOpen} title={selected?.title ?? ''} description={selected?.clientName}>
	{#if selected}
		<div class="flex flex-col gap-4">
			<p class="flex flex-wrap items-center gap-2">
				<span class="chip {stageTone(selected.stage)}">{STAGE_LABEL[selected.stage]}</span>
				{#if selected.booked}
					<span class="chip chip--success">DP lunas</span>
				{:else}
					<span class="chip chip--warning">Tentatif · belum DP</span>
				{/if}
			</p>
			{#if data.busyDays[selected.date]}
				<p
					class="flex items-start gap-2 rounded-card bg-warning-bg px-3 py-2 text-small text-warning"
				>
					<TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
					Ada {data.busyDays[selected.date]} booking di {dateID(selected.date, 'long')}.
				</p>
			{/if}
			<section class="flex flex-col gap-2" aria-labelledby="cal-sessions">
				<h3 id="cal-sessions" class="font-semibold">Sesi di kalender</h3>
				<ul class="card divide-y divide-line">
					{#each siblings as s (s.id)}
						<li class={['flex flex-col gap-0.5 px-3 py-2', s.id === selected.id && 'bg-sage-20']}>
							<span class="font-semibold">{EVENT_TYPE_LABEL[s.eventType]}</span>
							<span class="text-body"
								>{dateID(s.date, 'long')}{#if time(s)}
									· {time(s)} WIB{/if}</span
							>
							{#if s.venue || s.city}
								<span class="inline-flex items-center gap-1 text-small text-ink-2">
									<MapPin size={13} aria-hidden="true" />
									{[s.venue, s.city].filter(Boolean).join(', ')}
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
			<p class="flex justify-between gap-3 text-body">
				<span>Kru</span>
				<span class="text-right font-semibold"
					>{selected.crew.length ? selected.crew.join(', ') : 'Belum ada kru'}</span
				>
			</p>
			<p class="flex justify-between gap-3 text-body">
				<span>Harga disepakati</span>
				<span class="font-semibold tabular-nums">{rupiah(selected.agreedPrice)}</span>
			</p>
		</div>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (drawerOpen = false)}
			>Tutup</button
		>
		{#if data.allow.bookings && selected}
			<a
				class="btn btn--primary"
				href={resolve('/admin/(app)/booking/[id]', { id: selected.bookingId })}>Buka booking</a
			>
		{/if}
	{/snippet}
</Drawer>
