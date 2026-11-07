<script lang="ts">
	import CmsLink from '../CmsLink.svelte';

	type Props = {
		heading: string;
		body: string;
		button: { label: string; href: string };
	};

	let { heading, body, button }: Props = $props();
</script>

<section class="bg-sage-20 section-pad" aria-labelledby="packages-title">
	<div class="mx-auto flex max-w-[60ch] flex-col items-center gap-6 px-5 text-center">
		<p class="eyebrow text-ink-2">Paket</p>
		<h2 id="packages-title" class="font-display text-h2">{heading}</h2>
		{#if body}<p class="text-lead">{body}</p>{/if}
		{#if button.label && button.href}
			<CmsLink href={button.href} class="site-btn">{button.label}</CmsLink>
		{/if}
	</div>
</section>
