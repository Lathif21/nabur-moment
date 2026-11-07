<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import { socialUrl } from '#lib/cms/site-settings.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	type Post = { id: string; image: string; permalink: string; caption: string };

	type Props = {
		heading: string;
		handle: string;
		count: number;
		/** Latest Instagram posts (P1-10); empty until the feed is connected or when it fails */
		posts: Post[];
		/** CMS images shown when there are no posts */
		fallback: MediaItem[];
	};

	let { heading, handle, count, posts, fallback }: Props = $props();
	const profile = $derived(socialUrl('instagram', handle));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- links to Instagram (profile and posts) -->
<section class="section-pad" aria-labelledby="follow-title">
	<div class="mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 lg:px-10">
		<div class="flex flex-col items-center gap-2 text-center">
			<h2 id="follow-title" class="font-display text-h2">{heading}</h2>
			{#if profile}
				<a
					href={profile}
					target="_blank"
					rel="noopener noreferrer"
					class="eyebrow text-olive underline-offset-8 hover:underline"
					>{handle}<span class="sr-only"> di Instagram (tab baru)</span></a
				>
			{/if}
		</div>
		<ul class="grid w-full grid-cols-3 gap-1.5 md:gap-3">
			{#if posts.length}
				{#each posts.slice(0, count) as p (p.id)}
					<li>
						<a
							href={p.permalink}
							target="_blank"
							rel="noopener noreferrer"
							class="block aspect-square overflow-hidden bg-sage-20"
						>
							<img
								src={p.image}
								alt={p.caption.slice(0, 120) || 'Postingan Instagram'}
								loading="lazy"
								class="size-full object-cover"
							/>
						</a>
					</li>
				{/each}
			{:else}
				{#each fallback.slice(0, count) as m (m.id)}
					<li class="aspect-square overflow-hidden bg-sage-20">
						<CmsImage
							media={m}
							sizes="(min-width: 48rem) 30vw, 33vw"
							class="size-full object-cover"
						/>
					</li>
				{/each}
			{/if}
		</ul>
	</div>
</section>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
