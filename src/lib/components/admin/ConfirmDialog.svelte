<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { AlertDialog } from 'bits-ui';
	import { refreshThenToast } from '#lib/enhance.ts';

	type Props = {
		open: boolean;
		title: string;
		/** Body text; bold the name of the thing being changed */
		children: Snippet;
		/** Form action, e.g. "?/delete" */
		action: string;
		/** Hidden fields posted with the action */
		fields: Record<string, string>;
		confirmLabel: string;
		/** `dark` for archive-like actions, `danger` for deletes / void */
		tone?: 'dark' | 'danger';
		/** After the action succeeded (the page data is already fresh) */
		onsuccess?: () => void;
	};

	let {
		open = $bindable(),
		title,
		children,
		action,
		fields,
		confirmLabel,
		tone = 'dark',
		onsuccess
	}: Props = $props();
	let pending = $state(false);
</script>

<!-- Confirmation for a destructive form action. Expects { done } or fail(4xx, { error }). -->
<AlertDialog.Root bind:open>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-40 bg-forest/40" />
		<AlertDialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-surface p-6 shadow-modal"
		>
			<AlertDialog.Title class="font-display text-section-title">{title}</AlertDialog.Title>
			<AlertDialog.Description class="text-body text-ink-2">
				{@render children()}
			</AlertDialog.Description>
			<form
				method="post"
				{action}
				class="flex justify-end gap-2"
				use:enhance={refreshThenToast({
					start: () => (pending = true),
					end: (ok) => {
						pending = false;
						open = false;
						if (ok) onsuccess?.();
					}
				})}
			>
				{#each Object.entries(fields) as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				<!-- type="button": bits-ui renders a plain <button>, which inside this form would submit -->
				<AlertDialog.Cancel type="button" class="btn btn--secondary">Batal</AlertDialog.Cancel>
				<button
					type="submit"
					class={['btn', tone === 'danger' ? 'btn--danger' : 'btn--primary']}
					disabled={pending}
				>
					{confirmLabel}
				</button>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
