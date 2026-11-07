<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import Inbox from '@lucide/svelte/icons/inbox';

	type Props = {
		/** One sentence */
		message: string;
		/** Lucide icon; defaults to an empty tray */
		icon?: Component<{ size?: number; strokeWidth?: number; 'aria-hidden'?: 'true' }>;
		/** One button */
		action?: Snippet;
	};

	let { message, icon: Icon = Inbox, action }: Props = $props();
</script>

<div
	class="flex flex-col items-center gap-4 rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center"
>
	<span class="flex size-14 items-center justify-center rounded-full bg-sage-20 text-forest">
		<Icon size={26} strokeWidth={1.5} aria-hidden="true" />
	</span>
	<p class="max-w-md text-body text-ink-2">{message}</p>
	{#if action}{@render action()}{/if}
</div>
