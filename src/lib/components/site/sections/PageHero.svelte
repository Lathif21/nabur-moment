<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = { title: string; image?: MediaItem; eyebrow?: string };

	let { title, image, eyebrow }: Props = $props();
</script>

<!-- Inner-page hero: photo with the title over a forest veil (or a plain forest band) -->
<header class="relative isolate flex min-h-[60svh] items-end overflow-hidden bg-forest text-cream">
	{#if image}
		<CmsImage
			media={image}
			alt=""
			sizes="100vw"
			priority
			class="absolute inset-0 -z-10 size-full object-cover opacity-75"
		/>
		<div
			class="absolute inset-0 -z-10 bg-linear-to-t from-forest/85 via-forest/30 to-forest/40"
		></div>
	{/if}
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 pt-32 pb-14 lg:px-10">
		{#if eyebrow}<p class="eyebrow text-cream/90">{eyebrow}</p>{/if}
		<h1 class="font-display text-display">{title}</h1>
	</div>
</header>
