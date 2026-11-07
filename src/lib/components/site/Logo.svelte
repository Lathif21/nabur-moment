<script lang="ts">
	import Wordmark from '#lib/components/Wordmark.svelte';

	type Props = {
		/** Uploaded logo for this background (from site settings), or null for the typeset one */
		src: string | null;
		name: string;
		tone: 'cream' | 'forest';
		size?: 'sm' | 'md';
	};

	let { src, name, tone, size = 'sm' }: Props = $props();
</script>

{#if src}
	<img {src} alt={name} class={['w-auto', size === 'sm' ? 'h-10 lg:h-12' : 'h-14']} />
{:else}
	<Wordmark {tone} {size} />
{/if}
