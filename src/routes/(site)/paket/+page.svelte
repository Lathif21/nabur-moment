<script lang="ts">
	import { resolve } from '$app/paths';
	import PromoBadge from '#lib/components/site/PromoBadge.svelte';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import { discountPercent } from '#lib/cms/lists.ts';
	import { rupiah } from '#lib/format.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const intro = $derived(data.sections.intro);
	const list = $derived(data.sections.list.data);
	const notes = $derived(data.sections.notes);
	const promoLabel = $derived(String(list.promoLabel ?? ''));
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
				<header class="flex flex-col gap-2">
					<h2 id="cat-{cat.id}" class="font-display text-h2">{cat.name}</h2>
					{#if cat.subtitle}<p class="max-w-[60ch] text-lead text-ink-2">{cat.subtitle}</p>{/if}
				</header>
				<ul class="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
					{#each cat.packages as p (p.id)}
						{@const img = p.image ? data.media[p.image] : undefined}
						{@const off = discountPercent(p.price, p.normalPrice)}
						<li
							class={[
								'relative flex flex-col gap-4 border p-6',
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
							<h3 class={['font-display text-[1.5rem]', off && !img?.src && 'pr-24']}>{p.name}</h3>
							{#if p.normalPrice}
								<p
									class={[
										'flex flex-wrap items-baseline gap-x-3 lining-nums tabular-nums',
										off && !img?.src && 'pr-24'
									]}
								>
									<span class="font-display text-[1.75rem] whitespace-nowrap"
										><span class="sr-only">Harga promo </span>{rupiah(p.price)}</span
									>
									<s class="text-lead whitespace-nowrap opacity-70"
										><span class="sr-only">Harga normal </span>{rupiah(p.normalPrice)}</s
									>
								</p>
								{#if off > 0}
									<PromoBadge percent={off} label={promoLabel} inverse={p.featured} />
								{/if}
							{:else}
								<p class="font-display text-[1.75rem] lining-nums tabular-nums">
									{rupiah(p.price)}
								</p>
							{/if}
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
