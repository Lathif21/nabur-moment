<script lang="ts" module>
	/** What the flow needs to know about the booking being moved */
	export type MoveTarget = { title: string; bookedAt: Date | string | null };
</script>

<script lang="ts">
	// Stage-move flow shared by the board and the booking page: posts to the hosting page's
	// `?/move` action and opens the modals the rules need (DP belum lunas, Batal reason, Selesai
	// with a balance). Call `request(move, booking)` through bind:this.
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Modal from '#lib/components/admin/Modal.svelte';
	import { BOOKED_STAGES, STAGE_LABEL, type Stage } from '#lib/crm.ts';
	import type { KanbanMove } from '#lib/kanban.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		/** "Catat pembayaran DP" links to Keuangan only with the payments permission */
		allowPayments: boolean;
	};

	let { allowPayments }: Props = $props();

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
				error: String(result.data?.error ?? 'Booking gagal dipindahkan.')
			};
		return { ok: false, error: 'Booking gagal dipindahkan. Coba lagi.' };
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

	function showDp(move: KanbanMove, target: MoveTarget) {
		dpCard = { id: move.id, title: target.title, to: STAGE_LABEL[move.to as Stage] };
		dpOpen = true;
	}

	/**
	 * Run a move. Resolves true when saved, false when refused or cancelled in a modal; throws an
	 * Error with an Indonesian message on any other failure.
	 */
	export async function request(move: KanbanMove, target: MoveTarget): Promise<boolean> {
		// Booked needs a paid DP: refuse before the round trip (the server checks again)
		if (move.from !== move.to && BOOKED_STAGES.includes(move.to as Stage) && !target.bookedAt) {
			showDp(move, target);
			return false;
		}
		if (move.to === 'lost' && move.from !== 'lost') {
			lostTitle = target.title;
			lostReason = '';
			lostError = '';
			lostOpen = true;
			return waitFor(move);
		}
		const r = await send(moveFields(move));
		if (r.ok) return true;
		if (r.need === 'dp') {
			showDp(move, target);
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

	/** Closing a modal without confirming keeps the booking where it was */
	const cancelPending = () => pending?.settle(false);

	const paymentsHref = $derived(resolve('admin/keuangan/pembayaran'));
</script>

<Modal bind:open={dpOpen} title="DP belum lunas" description={dpCard?.title}>
	<p class="text-body">
		Booking baru bisa masuk <strong>{dpCard?.to ?? 'Booked'}</strong> setelah DP 50% dicatat lunas. Tanggal
		di kalender baru terkunci setelah itu.
	</p>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (dpOpen = false)}
			>Nanti saja</button
		>
		{#if allowPayments}
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
