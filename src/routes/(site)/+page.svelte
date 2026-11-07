<script lang="ts">
	import { asset } from '$app/paths';
	import Collage from '#lib/components/site/sections/Collage.svelte';
	import Cta from '#lib/components/site/sections/Cta.svelte';
	import FeaturedAlbums from '#lib/components/site/sections/FeaturedAlbums.svelte';
	import Follow from '#lib/components/site/sections/Follow.svelte';
	import Hero, { type HeroMedia } from '#lib/components/site/sections/Hero.svelte';
	import Intro from '#lib/components/site/sections/Intro.svelte';
	import PackagesTeaser from '#lib/components/site/sections/PackagesTeaser.svelte';
	import Testimonials from '#lib/components/site/sections/Testimonials.svelte';
	import Ticker from '#lib/components/site/sections/Ticker.svelte';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Link = { label: string; href: string };
	const s = $derived(data.sections);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
	const many = (ids: unknown): MediaItem[] =>
		Array.isArray(ids) ? ids.map(m).filter((x): x is MediaItem => !!x) : [];

	const heroMedia = $derived.by((): HeroMedia => {
		const media = m(s.hero.data.media);
		if (media?.kind === 'video') return { kind: 'video', src: media.src!, poster: media.poster };
		if (media?.kind === 'image')
			return {
				kind: 'image',
				src: media.src!,
				srcset: media.srcset,
				alt: media.alt,
				focalX: media.focalX,
				focalY: media.focalY
			};
		// Nothing chosen yet: the free stock clip (Mixkit #5223, see MEDIA-CREDITS.md)
		return { kind: 'video', src: asset('media/hero.mp4'), poster: asset('media/hero-poster.webp') };
	});
	// First section after the hero, for the "Gulir" cue
	const first = $derived(
		['collage', 'intro', 'ticker', 'featured', 'packages', 'testimonials', 'cta', 'follow'].find(
			(k) => s[k]?.visible
		)
	);
</script>

<svelte:head>
	<title>{data.site.seoTitle}</title>
</svelte:head>

{#if s.hero.visible}
	<Hero
		media={heroMedia}
		script={s.hero.data.script as string}
		headline={s.hero.data.headline as string}
		accent={s.hero.data.accent as string}
		caption={s.hero.data.caption as string}
		mono={s.hero.data.tone !== 'color'}
		next={first ? `beranda-${first}` : undefined}
	/>
{/if}

{#snippet anchor(key: string)}<span id="beranda-{key}" class="block scroll-mt-4"></span>{/snippet}

{#if s.collage.visible}
	{@render anchor('collage')}
	<Collage
		images={many(s.collage.data.images)}
		headline={s.collage.data.headline as string}
		button={s.collage.data.button as Link}
	/>
{/if}

{#if s.intro.visible}
	{@render anchor('intro')}
	<Intro
		id="intro"
		eyebrow={s.intro.data.eyebrow as string}
		headline={s.intro.data.headline as string}
		body={s.intro.data.body as string}
		image={m(s.intro.data.image)}
	/>
{/if}

{#if s.ticker.visible}
	{@render anchor('ticker')}
	<Ticker words={(s.ticker.data.words as { word: string }[]).map((w) => w.word).filter(Boolean)} />
{/if}

{#if s.featured.visible && data.featured.length}
	{@render anchor('featured')}
	<FeaturedAlbums
		heading={s.featured.data.heading as string}
		albums={data.featured}
		media={data.media}
	/>
{/if}

{#if s.packages.visible}
	{@render anchor('packages')}
	<PackagesTeaser
		heading={s.packages.data.heading as string}
		body={s.packages.data.body as string}
		button={s.packages.data.button as Link}
	/>
{/if}

{#if s.testimonials.visible && data.testimonials.length}
	{@render anchor('testimonials')}
	<Testimonials
		heading={s.testimonials.data.heading as string}
		items={data.testimonials}
		media={data.media}
	/>
{/if}

{#if s.cta.visible}
	{@render anchor('cta')}
	<Cta
		image={m(s.cta.data.image)}
		headline={s.cta.data.headline as string}
		button={s.cta.data.button as Link}
	/>
{/if}

{#if s.follow.visible && (data.posts.length || many(s.follow.data.fallback).length)}
	{@render anchor('follow')}
	<Follow
		heading={s.follow.data.heading as string}
		handle={s.follow.data.handle as string}
		count={Number(s.follow.data.count) || 6}
		posts={data.posts}
		fallback={many(s.follow.data.fallback)}
	/>
{/if}
