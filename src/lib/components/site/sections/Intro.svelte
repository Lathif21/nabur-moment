<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		eyebrow: string;
		headline: string;
		/** Sanitised on save (p, br, strong, em, a) */
		body: string;
		image?: MediaItem;
		/** Image on the left instead of the right */
		flip?: boolean;
		id?: string;
	};

	let { eyebrow, headline, body, image, flip = false, id }: Props = $props();
</script>

<section {id} class="section-pad" aria-labelledby="{id ?? 'intro'}-title">
	<div
		class={[
			'mx-auto grid max-w-6xl items-center gap-10 px-5 lg:px-10',
			image && 'lg:grid-cols-2 lg:gap-20'
		]}
	>
		<div
			class={[
				'flex flex-col gap-5',
				flip && 'lg:order-2',
				!image && 'mx-auto max-w-[60ch] text-center'
			]}
		>
			{#if eyebrow}<p class="eyebrow text-olive">{eyebrow}</p>{/if}
			<h2 id="{id ?? 'intro'}-title" class="font-display text-h2">{headline}</h2>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
			<div class="prose-site text-lead">{@html body}</div>
		</div>
		{#if image}
			<CmsImage
				media={image}
				sizes="(min-width: 64rem) 45vw, 90vw"
				class="aspect-4/5 w-full object-cover"
			/>
		{/if}
	</div>
</section>
