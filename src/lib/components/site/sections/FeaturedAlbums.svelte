<script lang="ts">
	import { resolve } from '$app/paths';
	import CoverImage from '../CoverImage.svelte';
	import type { PublishedAlbum } from '#lib/cms/lists.ts';
	import { EVENT_TYPE_LABEL, type EventType } from '#lib/crm.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		heading: string;
		/** Every published album, cover already resolved (see loadPortfolio) */
		albums: Omit<PublishedAlbum, 'items'>[];
		media: Record<string, MediaItem>;
	};

	let { heading, albums, media }: Props = $props();
</script>

<section class="section-pad" aria-labelledby="featured-title">
	<div class="mx-auto flex max-w-6xl flex-col gap-10 px-5 lg:px-10">
		<h2 id="featured-title" class="font-display text-h2">{heading}</h2>
		<ul class="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
			{#each albums as a (a.id)}
				<li>
					<a href={resolve('/(site)/portofolio/[slug]', { slug: a.slug })} class="group block">
						<span class="block aspect-4/5 overflow-hidden bg-sage-20">
							<CoverImage
								media={a.cover ? media[a.cover] : undefined}
								sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 90vw"
								class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
							/>
						</span>
						<span class="mt-4 block font-display text-[1.5rem] italic">{a.title}</span>
						<span class="block text-caption tracking-[0.16em] text-ink-2 uppercase">
							{EVENT_TYPE_LABEL[a.eventType as EventType] ?? a.eventType}{a.city
								? ` · ${a.city}`
								: ''}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
</section>
