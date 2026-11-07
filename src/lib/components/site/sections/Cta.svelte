<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import CmsLink from '../CmsLink.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		image?: MediaItem;
		headline: string;
		button: { label: string; href: string };
	};

	let { image, headline, button }: Props = $props();
</script>

<section class="relative isolate overflow-hidden bg-forest text-cream" aria-labelledby="cta-title">
	{#if image}
		<CmsImage
			media={image}
			alt=""
			sizes="100vw"
			class="absolute inset-0 -z-10 size-full object-cover opacity-55"
		/>
	{/if}
	<div class="mx-auto flex max-w-3xl flex-col items-center gap-8 px-5 py-28 text-center lg:py-40">
		<h2 id="cta-title" class="font-display text-h1">{headline}</h2>
		{#if button.label && button.href}
			<CmsLink href={button.href} class="site-btn site-btn--inverse">{button.label}</CmsLink>
		{/if}
	</div>
</section>
