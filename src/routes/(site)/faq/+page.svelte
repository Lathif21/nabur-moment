<script lang="ts">
	import FaqAccordion from '#lib/components/site/FaqAccordion.svelte';
	import Cta from '#lib/components/site/sections/Cta.svelte';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const intro = $derived(data.sections.intro);
	const cta = $derived(data.sections.cta);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
</script>

{#if hero.visible}
	<PageHero
		title={hero.data.title as string}
		image={m(hero.data.image)}
		eyebrow={hero.data.eyebrow as string}
	/>
{/if}

<section class={['section-pad', !hero.visible && 'border-t border-sage']}>
	<div class="mx-auto flex max-w-3xl flex-col gap-12">
		<header class="flex flex-col gap-4 text-center">
			{#if intro.visible}
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<svelte:element this={hero.visible ? 'h2' : 'h1'} class="font-display text-h1"
					>{intro.data.headline}</svelte:element
				>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html intro.data.body}</div>
			{:else if !hero.visible}
				<h1 class="sr-only">{data.meta.title}</h1>
			{/if}
		</header>

		{#if data.faq.length}
			<FaqAccordion items={data.faq} />
		{:else}
			<p class="text-center text-lead text-ink-2">{data.sections.list.data.emptyText}</p>
		{/if}
	</div>
</section>

{#if cta.visible}
	<Cta
		image={m(cta.data.image)}
		headline={cta.data.headline as string}
		button={cta.data.button as { label: string; href: string }}
	/>
{/if}
