<script lang="ts">
	import { pictureOf } from '#lib/media/cover.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		/** A photo, video (its poster) or embed (its thumbnail) */
		media: MediaItem | undefined | null;
		/** `sizes` for srcset, e.g. "(min-width: 64rem) 30vw, 90vw" */
		sizes: string;
		class?: string;
		/** Above the fold: load eagerly with high priority */
		priority?: boolean;
	};

	let { media, sizes, class: className, priority = false }: Props = $props();

	const pic = $derived(pictureOf(media));
	// Set when the main still fails (YouTube HD still missing): show the fallback instead
	let failedSrc = $state<string | null>(null);
	const useFallback = $derived(!!pic?.fallback && failedSrc === pic.src);
</script>

<!-- An album cover: decorative (the album title sits next to it), focal-point crop -->
{#if pic}
	<img
		src={useFallback ? pic.fallback : pic.src}
		srcset={useFallback ? undefined : (pic.srcset ?? undefined)}
		{sizes}
		alt=""
		width={pic.width}
		height={pic.height}
		loading={priority ? 'eager' : 'lazy'}
		fetchpriority={priority ? 'high' : undefined}
		decoding="async"
		class={className}
		style:object-position="{pic.focalX * 100}% {pic.focalY * 100}%"
		onerror={() => (failedSrc = pic.src)}
	/>
{/if}
