<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		/** Short line under the title */
		description?: string;
		/** Buttons on the right (one primary at most) */
		actions?: Snippet;
	};

	let { title, description, actions }: Props = $props();
</script>

<svelte:head>
	<title>{title} · Nabur Moment Admin</title>
</svelte:head>

<header class="flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="font-display text-page-title">{title}</h1>
		{#if description}<p class="mt-1 text-body text-ink-2">{description}</p>{/if}
	</div>
	{#if actions}<div class="flex flex-wrap gap-2">{@render actions()}</div>{/if}
</header>
