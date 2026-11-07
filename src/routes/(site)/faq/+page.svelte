<script lang="ts">
	import FaqAccordion from '#lib/components/site/FaqAccordion.svelte';
	import Cta from '#lib/components/site/sections/Cta.svelte';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const intro = $derived(data.sections.intro);
	const cta = $derived(data.sections.cta);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
</script>

<section class="border-t border-sage section-pad">
	<div class="mx-auto flex max-w-3xl flex-col gap-12">
		<header class="flex flex-col gap-4 text-center">
			{#if intro.visible}
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<h1 class="font-display text-h1">{intro.data.headline}</h1>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html intro.data.body}</div>
			{:else}
				<h1 class="font-display text-h1">FAQ</h1>
			{/if}
		</header>

		{#if data.faq.length}
			<FaqAccordion items={data.faq} />
		{:else}
			<p class="text-center text-lead text-ink-2">Belum ada pertanyaan.</p>
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
