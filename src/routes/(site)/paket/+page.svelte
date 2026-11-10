<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import { rupiah } from '#lib/format.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const intro = $derived(data.sections.intro);
	const list = $derived(data.sections.list.data);
	const notes = $derived(data.sections.notes);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
</script>

<!-- Paket from the CMS: intro + published packages / add-ons + notes. P1-06 adds the full design. -->
{#if hero.visible}
	<PageHero
		title={hero.data.title as string}
		image={m(hero.data.image)}
		eyebrow={hero.data.eyebrow as string}
	/>
{/if}

<section class={['section-pad', !hero.visible && 'border-t border-sage']}>
	<div class="mx-auto flex max-w-6xl flex-col gap-14">
		{#if intro.visible}
			<header class="mx-auto flex max-w-[60ch] flex-col gap-4 text-center">
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<svelte:element this={hero.visible ? 'h2' : 'h1'} class="font-display text-h1"
					>{intro.data.headline}</svelte:element
				>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html intro.data.body}</div>
			</header>
		{:else if !hero.visible}
			<h1 class="sr-only">{data.meta.title}</h1>
		{/if}

		{#each data.packages.categories as cat (cat.id)}
			<section aria-labelledby="cat-{cat.id}" class="flex flex-col gap-6">
				<h2 id="cat-{cat.id}" class="font-display text-h2">{cat.name}</h2>
				<ul class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
					{#each cat.packages as p (p.id)}
						{@const img = p.image ? data.media[p.image] : undefined}
						<li
							class={[
								'flex flex-col gap-4 border p-6',
								p.featured ? 'border-forest bg-forest text-cream' : 'border-sage bg-surface'
							]}
						>
							{#if img?.src}
								<img
									src={img.thumb}
									srcset={img.srcset}
									sizes="(min-width: 64rem) 30vw, (min-width: 48rem) 45vw, 90vw"
									alt={img.alt}
									class="aspect-4/3 w-full object-cover"
									style:object-position="{img.focalX * 100}% {img.focalY * 100}%"
									loading="lazy"
								/>
							{/if}
							<h3 class="font-display text-[1.5rem]">{p.name}</h3>
							<p class="font-display text-[1.75rem] lining-nums tabular-nums">{rupiah(p.price)}</p>
							{#if p.inclusions.length}
								<ul class="flex list-disc flex-col gap-1.5 pl-5">
									{#each p.inclusions as line, i (i)}<li>{line}</li>{/each}
								</ul>
							{/if}
							{#if p.note}<p class="text-small opacity-80">{p.note}</p>{/if}
							<a
								href={resolve(`booking?paket=${p.id}` as 'booking')}
								class={['site-btn mt-auto', p.featured && 'site-btn--inverse']}
								>{list.chooseLabel}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			<p class="text-center text-lead text-ink-2">{list.emptyText}</p>
		{/each}

		{#if data.packages.addons.length}
			<section aria-labelledby="addons" class="flex flex-col gap-4">
				<h2 id="addons" class="font-display text-h2">{list.addonsHeading}</h2>
				<ul class="divide-y divide-sage border-y border-sage">
					{#each data.packages.addons as a (a.id)}
						<li class="flex flex-wrap items-baseline justify-between gap-2 py-4">
							<span>
								<span class="font-semibold">{a.name}</span>
								{#if a.description}<span class="block text-small text-ink-2">{a.description}</span
									>{/if}
							</span>
							<span class="lining-nums tabular-nums">{rupiah(a.price)}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if notes.visible}
			<section aria-labelledby="notes" class="mx-auto flex max-w-[60ch] flex-col gap-3">
				<h2 id="notes" class="font-display text-h2">{notes.data.heading}</h2>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html notes.data.body}</div>
			</section>
		{/if}
	</div>
</section>
