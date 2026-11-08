<script lang="ts">
	import { resolve } from '$app/paths';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import List from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import BookingDrawer from '#lib/components/crm/BookingDrawer.svelte';
	import BookingMoveDialogs from '#lib/components/crm/BookingMoveDialogs.svelte';
	import KanbanBoard, { type KanbanColumn } from '#lib/components/kanban/KanbanBoard.svelte';
	import MoveMenu from '#lib/components/kanban/MoveMenu.svelte';
	import { EVENT_TYPE_LABEL, STAGES } from '#lib/crm.ts';
	import { countdown, dateID, rupiahShort } from '#lib/format.ts';
	import { toLanes, type KanbanMove } from '#lib/kanban.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Card = (typeof data.cards)[number];

	const columns: KanbanColumn[] = STAGES.map((s) => ({
		key: s.key,
		label: s.label,
		collapsed: s.key === 'lost'
	}));
	const lanes = $derived(
		toLanes(
			data.cards,
			STAGES.map((s) => s.key),
			(c) => c.stage
		)
	);
	const totalValue = $derived(
		data.cards.filter((c) => c.stage !== 'lost').reduce((s, c) => s + c.agreedPrice, 0)
	);
	const activeCount = $derived(data.cards.filter((c) => c.stage !== 'lost').length);
	const cardById = (id: string) => data.cards.find((c) => c.id === id);

	// ---------- drawer ----------
	let drawerOpen = $state(false);

	// Moves go through the shared flow (DP / Batal / Selesai modals)
	let dialogs: BookingMoveDialogs;
	async function onMove(move: KanbanMove): Promise<boolean> {
		const c = cardById(move.id);
		return dialogs.request(move, { title: c?.title ?? '', bookedAt: c?.bookedAt ?? null });
	}
</script>

<div class="page-body">
	<PageHeader
		title="Booking"
		description="{activeCount} booking aktif · {rupiahShort(
			totalValue
		)}. Seret kartu, atau pakai menu Pindah ke…"
	>
		{#snippet actions()}
			<a class="btn btn--secondary" href={resolve('admin/booking/daftar')}>
				<List size={16} aria-hidden="true" /> Daftar
			</a>
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={() => (drawerOpen = true)}>
					<Plus size={16} aria-hidden="true" /> Booking baru
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<KanbanBoard
		label="Pipeline booking"
		type="booking"
		{columns}
		{lanes}
		itemLabel={(c: Card) => `${c.title}, ${c.clientName}`}
		total={(items: Card[]) =>
			items.length ? rupiahShort(items.reduce((s, c) => s + c.agreedPrice, 0)) : null}
		{onMove}
	>
		{#snippet card(c: Card, ctx)}
			<article class="kcard flex flex-col gap-1.5 rounded-card border border-line bg-surface p-3">
				<div class="flex items-start justify-between gap-2">
					<span class="min-w-0 truncate text-small text-ink-2">{c.clientName}</span>
					<span class="chip shrink-0">{EVENT_TYPE_LABEL[c.eventType]}</span>
				</div>
				<h3 class="text-body leading-snug font-semibold">
					<a
						class="underline-offset-2 hover:underline"
						href={resolve('/admin/(app)/booking/[id]', { id: c.id })}
						draggable="false">{c.title}</a
					>
				</h3>
				{#if c.nextDate}
					<p class="flex items-center gap-1.5 text-small">
						<CalendarDays size={14} class="text-ink-2" aria-hidden="true" />
						{dateID(c.nextDate)}
						{#if c.stage !== 'lost' && c.stage !== 'completed'}
							<span class="font-semibold">{countdown(c.nextDate)}</span>
						{/if}
					</p>
				{:else}
					<p class="text-small text-ink-2">Tanggal belum ditentukan</p>
				{/if}
				{#if c.packageName}<p class="truncate text-small text-ink-2">{c.packageName}</p>{/if}
				<div class="mt-1 flex items-center gap-2">
					<span class="font-semibold tabular-nums">{rupiahShort(c.agreedPrice)}</span>
					{#if c.stage !== 'lost'}
						{#if c.bookedAt}
							<span class="chip chip--success">DP lunas</span>
						{:else}
							<span class="chip chip--warning">Belum DP</span>
						{/if}
					{/if}
					<span class="flex-1"></span>
					{#if data.allow.update}
						<MoveMenu
							itemLabel={c.title}
							targets={ctx.targets}
							onmove={ctx.moveTo}
							disabled={ctx.busy}
						/>
					{/if}
				</div>
			</article>
		{/snippet}
	</KanbanBoard>
</div>

<BookingDrawer
	bind:open={drawerOpen}
	bookingId={null}
	options={data.options}
	allowNewClient={data.allow.newClient}
/>

<BookingMoveDialogs bind:this={dialogs} allowPayments={data.allow.payments} />
