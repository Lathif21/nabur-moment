<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CoverImage from '#lib/components/site/CoverImage.svelte';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import { EVENT_TYPE_LABEL, EVENT_TYPES, type EventType } from '#lib/crm.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const intro = $derived(data.sections.intro);
	const list = $derived(data.sections.list.data);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
	// ?jenis=akad keeps the filter shareable
	const active = $derived(page.url.searchParams.get('jenis') ?? '');
	const kinds = $derived(EVENT_TYPES.filter((e) => data.albums.some((a) => a.eventType === e.key)));
	const shown = $derived(active ? data.albums.filter((a) => a.eventType === active) : data.albums);
</script>

{#if hero.visible}
	<PageHero
		title={hero.data.title as string}
		image={m(hero.data.image)}
		eyebrow={hero.data.eyebrow as string}
	/>
{/if}

<section class={['section-pad', !hero.visible && 'border-t border-sage']}>
	<div class="mx-auto flex max-w-6xl flex-col gap-10 px-0">
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

		{#if kinds.length > 1}
			<nav aria-label="Saring album" class="flex flex-wrap justify-center gap-2">
				<a
					href={resolve('portofolio')}
					aria-current={active === '' ? 'page' : undefined}
					data-sveltekit-noscroll
					class="chip px-3! py-1.5! aria-[current=page]:bg-forest aria-[current=page]:text-cream"
					>{list.allLabel}</a
				>
				{#each kinds as k (k.key)}
					<a
						href={resolve(`portofolio?jenis=${k.key}` as 'portofolio')}
						aria-current={active === k.key ? 'page' : undefined}
						data-sveltekit-noscroll
						class="chip px-3! py-1.5! aria-[current=page]:bg-forest aria-[current=page]:text-cream"
						>{k.label}</a
					>
				{/each}
			</nav>
		{/if}

		{#if shown.length}
			<ul class="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
				{#each shown as a (a.id)}
					<li>
						<a href={resolve('/(site)/portofolio/[slug]', { slug: a.slug })} class="group block">
							<span class="block aspect-4/5 overflow-hidden bg-sage-20">
								<CoverImage
									media={a.cover ? data.media[a.cover] : undefined}
									sizes="(min-width: 64rem) 30vw, 45vw"
									class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
								/>
							</span>
							<span class="mt-3 block font-display text-[1.375rem] italic">{a.title}</span>
							<span class="block text-caption tracking-[0.16em] text-ink-2 uppercase">
								{EVENT_TYPE_LABEL[a.eventType as EventType] ?? a.eventType}{a.city
									? ` · ${a.city}`
									: ''}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-center text-lead text-ink-2">{list.emptyText}</p>
		{/if}
	</div>
</section>
