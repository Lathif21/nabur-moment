<script lang="ts">
	// After the payment that completes the DP: offer the move to Booked (P3-04). Posts to the
	// hosting page's `?/move` action, which applies the same rules as the board.
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/admin/Modal.svelte';
	import { refreshThenToast } from '#lib/enhance.ts';

	type Props = { open: boolean; bookingId: string; bookingTitle?: string };

	let { open = $bindable(), bookingId, bookingTitle }: Props = $props();
	let busy = $state(false);
</script>

<Modal bind:open title="DP lunas" description={bookingTitle}>
	<form
		id="dp-paid-form"
		method="post"
		action="?/move"
		use:enhance={refreshThenToast({
			start: () => (busy = true),
			end: (ok) => {
				busy = false;
				if (ok) open = false;
			}
		})}
	>
		<input type="hidden" name="id" value={bookingId} />
		<input type="hidden" name="to" value="booked" />
		<p class="text-body">
			DP sudah lunas. Pindahkan booking ini ke <strong>Booked</strong>? Tanggalnya terkunci di
			kalender.
		</p>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}
			>Nanti saja</button
		>
		<button type="submit" form="dp-paid-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Pindahkan ke Booked'}
		</button>
	{/snippet}
</Modal>
