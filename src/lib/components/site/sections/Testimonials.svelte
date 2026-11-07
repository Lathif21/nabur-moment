<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import type { TestimonialSnapshot } from '#lib/cms/lists.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		heading: string;
		items: TestimonialSnapshot;
		media: Record<string, MediaItem>;
	};

	let { heading, items, media }: Props = $props();
</script>

<section class="section-pad" aria-labelledby="testimonials-title">
	<div class="mx-auto flex max-w-6xl flex-col gap-10">
		<h2 id="testimonials-title" class="px-5 text-center font-display text-h2 lg:px-10">
			{heading}
		</h2>
		<!-- Phones: swipe sideways (scroll-snap); larger screens: a grid -->
		<ul
			class="flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-10"
		>
			{#each items as t (t.id)}
				<li class="w-[85%] shrink-0 snap-center lg:w-auto">
					<figure class="flex h-full flex-col gap-6 border border-sage bg-surface p-8">
						<blockquote class="font-display text-[1.375rem] leading-snug italic">
							“{t.quote}”
						</blockquote>
						<figcaption class="mt-auto flex items-center gap-4">
							{#if t.photo && media[t.photo]}
								<CmsImage
									media={media[t.photo]}
									alt=""
									sizes="56px"
									class="size-14 rounded-full object-cover"
								/>
							{/if}
							<span>
								<span class="block eyebrow">{t.name}</span>
								{#if t.eventLabel}<span class="block text-small text-ink-2">{t.eventLabel}</span
									>{/if}
							</span>
						</figcaption>
					</figure>
				</li>
			{/each}
		</ul>
	</div>
</section>
