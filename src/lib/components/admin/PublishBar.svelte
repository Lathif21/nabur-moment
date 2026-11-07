<script lang="ts">
	import { enhance } from '$app/forms';
	import Send from '@lucide/svelte/icons/send';
	import { dateID } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		/** The list differs from what is live */
		dirty: boolean;
		publishedAt: Date | string | null;
		canPublish: boolean;
		/** Form action, default ?/publish */
		action?: string;
	};

	let { dirty, publishedAt, canPublish, action = '?/publish' }: Props = $props();
	let busy = $state(false);
</script>

<!-- "Belum diterbitkan" + Terbitkan for a CMS list (03-SCREENS B7) -->
<div class="flex flex-wrap items-center gap-3">
	{#if dirty}
		<span class="chip chip--warning">Belum diterbitkan</span>
	{:else}
		<span class="chip chip--success">Terbit</span>
	{/if}
	{#if publishedAt}
		<span class="text-small text-ink-2">Terakhir terbit {dateID(publishedAt, 'datetime')}</span>
	{/if}
	{#if canPublish}
		<form
			method="post"
			{action}
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					busy = false;
					if (result.type === 'success') toast.success(String(result.data?.done));
					if (result.type === 'failure') toast.error(String(result.data?.error));
				};
			}}
		>
			<button type="submit" class="btn btn--primary" disabled={busy || !dirty}>
				<Send size={16} aria-hidden="true" />
				{busy ? 'Menerbitkan…' : 'Terbitkan'}
			</button>
		</form>
	{/if}
</div>
