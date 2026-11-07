<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import CmsLink from '../CmsLink.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		images: MediaItem[];
		headline: string;
		button: { label: string; href: string };
	};

	let { images, headline, button }: Props = $props();

	// Desktop: scattered around the headline (percent of the band); phones get a staggered grid
	const SLOTS = [
		{ top: 4, left: 3, w: 17 },
		{ top: 58, left: 9, w: 14 },
		{ top: 10, left: 26, w: 12 },
		{ top: 66, left: 30, w: 15 },
		{ top: 3, left: 70, w: 15 },
		{ top: 54, left: 74, w: 18 },
		{ top: 28, left: 87, w: 11 },
		{ top: 76, left: 55, w: 11 },
		{ top: 6, left: 50, w: 10 }
	];
	const placed = $derived(images.slice(0, SLOTS.length));
</script>

<section class="overflow-hidden bg-forest text-cream" aria-labelledby="collage-title">
	<!-- Phones: two staggered columns, then the headline -->
	<div class="grid grid-cols-2 gap-3 px-5 pt-16 lg:hidden">
		{#each placed as m, i (m.id)}
			<div class={i % 2 === 1 ? 'translate-y-8' : ''}>
				<CmsImage media={m} sizes="45vw" class="aspect-3/4 w-full object-cover" />
			</div>
		{/each}
	</div>

	<div
		class={[
			'relative mx-auto max-w-7xl px-5 py-20 lg:px-10',
			placed.length ? 'lg:h-[46rem] lg:py-0' : 'lg:py-28'
		]}
	>
		{#each placed as m, i (m.id)}
			<div
				class="collage-photo absolute hidden lg:block"
				style:top="{SLOTS[i].top}%"
				style:left="{SLOTS[i].left}%"
				style:width="{SLOTS[i].w}%"
				style:--delay="{i * 120}ms"
			>
				<CmsImage media={m} sizes="20vw" class="aspect-3/4 w-full object-cover shadow-modal" />
			</div>
		{/each}
		<div
			class="relative flex h-full flex-col items-center justify-center gap-8 text-center lg:mx-auto lg:max-w-md"
		>
			<h2 id="collage-title" class="font-display text-h1">{headline}</h2>
			{#if button.label && button.href}
				<CmsLink href={button.href} class="site-btn site-btn--inverse">{button.label}</CmsLink>
			{/if}
		</div>
	</div>
</section>

<style>
	.collage-photo {
		animation: float 9s ease-in-out infinite alternate;
		animation-delay: var(--delay);
	}
	@keyframes float {
		to {
			translate: 0 -10px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.collage-photo {
			animation: none;
		}
	}
</style>
