<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Dialog } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';

	type Props = {
		open: boolean;
		title: string;
		description?: string;
		children: Snippet;
		footer?: Snippet;
		/** `xl` for pickers and galleries */
		size?: 'md' | 'xl';
		/** Called when the person dismisses it (X, Esc, overlay) */
		onclose?: () => void;
	};

	let {
		open = $bindable(),
		title,
		description,
		children,
		footer,
		onclose,
		size = 'md'
	}: Props = $props();
</script>

<!-- Centred dialog for decisions (DP belum lunas, Batal reason). Drawers are for create / edit forms. -->
<Dialog.Root
	bind:open
	onOpenChange={(o) => {
		if (!o) onclose?.();
	}}
>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-40 bg-forest/40" />
		<Dialog.Content
			class={[
				'fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-card bg-surface shadow-modal',
				size === 'xl' ? 'h-[calc(100dvh-32px)] max-w-5xl' : 'max-w-lg'
			]}
		>
			<div class="flex items-start gap-3 px-6 pt-5 pb-4">
				<div class="min-w-0 flex-1">
					<Dialog.Title class="font-display text-section-title">{title}</Dialog.Title>
					{#if description}
						<Dialog.Description class="mt-1 text-small text-ink-2">{description}</Dialog.Description
						>
					{/if}
				</div>
				<Dialog.Close type="button" class="icon-btn shrink-0" aria-label="Tutup">
					<X size={18} strokeWidth={1.75} aria-hidden="true" />
				</Dialog.Close>
			</div>
			<div class="flex-1 overflow-y-auto px-6 pb-4 text-body">
				{@render children()}
			</div>
			{#if footer}
				<div class="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3">
					{@render footer()}
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
