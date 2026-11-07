<script lang="ts">
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		media: MediaItem | undefined | null;
		/** `sizes` for srcset, e.g. "(min-width: 64rem) 50vw, 100vw" */
		sizes: string;
		class?: string;
		/** Above the fold: load eagerly with high priority */
		priority?: boolean;
		/** Override the media's alt (decorative images pass "") */
		alt?: string;
	};

	let { media, sizes, class: className, priority = false, alt }: Props = $props();
</script>

<!-- A CMS image: WebP renditions in srcset, real size against layout shift, focal-point crop -->
{#if media?.kind === 'image' && media.src}
	<img
		src={media.thumb ?? media.src}
		srcset={media.srcset ?? undefined}
		{sizes}
		alt={alt ?? media.alt}
		width={media.width}
		height={media.height}
		loading={priority ? 'eager' : 'lazy'}
		fetchpriority={priority ? 'high' : undefined}
		decoding="async"
		class={className}
		style:object-position="{media.focalX * 100}% {media.focalY * 100}%"
	/>
{/if}
