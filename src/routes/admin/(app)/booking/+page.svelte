<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import List from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import Modal from '#lib/components/admin/Modal.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import BookingDrawer from '#lib/components/crm/BookingDrawer.svelte';
	import KanbanBoard, { type KanbanColumn } from '#lib/components/kanban/KanbanBoard.svelte';
	import MoveMenu from '#lib/components/kanban/MoveMenu.svelte';
	import { BOOKED_STAGES, EVENT_TYPE_LABEL, STAGES, STAGE_LABEL, type Stage } from '#lib/crm.ts';
	import { countdown, dateID, rupiahShort } from '#lib/format.ts';
	import { toLanes, type KanbanMove } from '#lib/kanban.ts';
	import { toast } from '#lib/toast.ts';
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
	let editingId = $state<string | null>(null);
	function openBooking(id: string | null) {
		editingId = id;
		drawerOpen = true;
	}

	// ---------- talking to the move action from code ----------
	async function post(fields: Record<string, string>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.append(k, v);
		const res = await fetch('?/move', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		return deserialize(await res.text());
	}

	const moveFields = (m: KanbanMove) => ({
		id: m.id,
		to: m.to,
		beforeId: m.beforeId ?? '',
		afterId: m.afterId ?? ''
	});

	type Outcome = { ok: true } | { ok: false; need?: string; error: string };

	async function send(fields: Record<string, string>): Promise<Outcome> {
		const result = await post(fields);
		if (result.type === 'success') {
			await invalidateAll();
			toast.success(String(result.data?.done ?? 'Tersimpan.'));
			return { ok: true };
		}
		if (result.type === 'failure')
			return {
				ok: false,
				need: result.data?.need as string | undefined,
				error: String(result.data?.error ?? 'Kartu gagal dipindahkan.')
			};
		return { ok: false, error: 'Kartu gagal dipindahkan. Coba lagi.' };
	}

	// A move waiting for a modal (Batal reason, Selesai balance). Settles exactly once.
	let pending: { move: KanbanMove; settle: (ok: boolean) => void } | null = null;
	function waitFor(move: KanbanMove) {
		return new Promise<boolean>((done) => {
			let settled = false;
			pending = {
				move,
				settle: (ok) => {
					if (settled) return;
					settled = true;
					pending = null;
					done(ok);
				}
			};
		});
	}

	let dpOpen = $state(false);
	let dpCard = $state<{ id: string; title: string; to: string } | null>(null);
	let lostOpen = $state(false);
	let lostTitle = $state('');
	let lostReason = $state('');
	let lostError = $state('');
	let balanceOpen = $state(false);
	let balanceText = $state('');
	let modalBusy = $state(false);

	function showDp(move: KanbanMove) {
		const c = cardById(move.id);
		dpCard = { id: move.id, title: c?.title ?? '', to: STAGE_LABEL[move.to as Stage] };
		dpOpen = true;
	}

	async function onMove(move: KanbanMove): Promise<boolean> {
		const c = cardById(move.id);
		// Booked needs a paid DP: refuse before the round trip (the server checks again)
		if (move.from !== move.to && BOOKED_STAGES.includes(move.to as Stage) && !c?.bookedAt) {
			showDp(move);
			return false;
		}
		if (move.to === 'lost' && move.from !== 'lost') {
			lostTitle = c?.title ?? '';
			lostReason = '';
			lostError = '';
			lostOpen = true;
			return waitFor(move);
		}
		const r = await send(moveFields(move));
		if (r.ok) return true;
		if (r.need === 'dp') {
			showDp(move);
			return false;
		}
		if (r.need === 'confirmBalance') {
			balanceText = r.error;
			balanceOpen = true;
			return waitFor(move);
		}
		throw new Error(r.error);
	}

	async function submitLost(e: SubmitEvent) {
		e.preventDefault();
		if (!pending) return;
		if (!lostReason.trim()) {
			lostError = 'Tulis alasan batal.';
			return;
		}
		modalBusy = true;
		const r = await send({ ...moveFields(pending.move), lostReason: lostReason.trim() });
		modalBusy = false;
		if (!r.ok) {
			lostError = r.error;
			return;
		}
		lostOpen = false;
		pending?.settle(true);
	}

	async function confirmBalance() {
		if (!pending) return;
		modalBusy = true;
		const r = await send({ ...moveFields(pending.move), confirmBalance: 'yes' });
		modalBusy = false;
		balanceOpen = false;
		if (!r.ok) toast.error(r.error);
		pending?.settle(r.ok);
	}

	/** Closing a modal without confirming puts the card back */
	const cancelPending = () => pending?.settle(false);

	const paymentsHref = $derived(resolve('admin/keuangan/pembayaran'));
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
				<button type="button" class="btn btn--primary" onclick={() => openBooking(null)}>
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
					{#if data.allow.update}
						<button
							type="button"
							class="text-left underline-offset-2 hover:underline"
							onclick={() => openBooking(c.id)}>{c.title}</button
						>
					{:else}{c.title}{/if}
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
	bookingId={editingId}
	options={data.options}
	allowNewClient={data.allow.newClient}
/>

<Modal bind:open={dpOpen} title="DP belum lunas" description={dpCard?.title}>
	<p class="text-body">
		Booking baru bisa masuk <strong>{dpCard?.to ?? 'Booked'}</strong> setelah DP 50% dicatat lunas. Tanggal
		di kalender baru terkunci setelah itu.
	</p>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (dpOpen = false)}
			>Nanti saja</button
		>
		{#if data.allow.payments}
			<a class="btn btn--primary" href="{paymentsHref}?booking={dpCard?.id ?? ''}"
				>Catat pembayaran DP</a
			>
		{:else}
			<button type="button" class="btn btn--primary" disabled title="Butuh akses Pembayaran"
				>Catat pembayaran DP</button
			>
		{/if}
	{/snippet}
</Modal>

<Modal bind:open={lostOpen} title="Tandai batal" description={lostTitle} onclose={cancelPending}>
	<form id="lost-form" class="flex flex-col gap-3" onsubmit={submitLost} novalidate>
		<p class="text-body text-ink-2">
			DP yang sudah dibayar tetap tercatat sebagai pemasukan (tidak dikembalikan).
		</p>
		<div class="field">
			<label for="lost-reason"
				>Alasan batal <span class="text-danger" aria-hidden="true">*</span></label
			>
			<textarea
				id="lost-reason"
				class="input min-h-20"
				maxlength="500"
				bind:value={lostReason}
				aria-invalid={lostError ? 'true' : undefined}
				aria-describedby={lostError ? 'lost-reason-error' : undefined}></textarea>
			{#if lostError}<p id="lost-reason-error" class="field__error">{lostError}</p>{/if}
		</div>
	</form>
	{#snippet footer()}
		<button
			type="button"
			class="btn btn--secondary"
			onclick={() => {
				lostOpen = false;
				cancelPending();
			}}>Batal</button
		>
		<button type="submit" form="lost-form" class="btn btn--danger" disabled={modalBusy}>
			{modalBusy ? 'Menyimpan…' : 'Tandai batal'}
		</button>
	{/snippet}
</Modal>

<Modal bind:open={balanceOpen} title="Masih ada sisa tagihan" onclose={cancelPending}>
	<p class="text-body">{balanceText}</p>
	{#snippet footer()}
		<button
			type="button"
			class="btn btn--secondary"
			onclick={() => {
				balanceOpen = false;
				cancelPending();
			}}>Batal</button
		>
		<button type="button" class="btn btn--primary" disabled={modalBusy} onclick={confirmBalance}>
			{modalBusy ? 'Menyimpan…' : 'Tetap tandai Selesai'}
		</button>
	{/snippet}
</Modal>
