<script lang="ts">
	import { resolve } from '$app/paths';
	import Play from '@lucide/svelte/icons/play';
	import CmsLink from '#lib/components/site/CmsLink.svelte';
	import CoverImage from '#lib/components/site/CoverImage.svelte';
	import Lightbox from '#lib/components/site/Lightbox.svelte';
	import { paragraphs } from '#lib/cms/lists.ts';
	import { EVENT_TYPE_LABEL, type EventType } from '#lib/crm.ts';
	import { dateID } from '#lib/format.ts';
	import { embedAspect, embedSrc } from '#lib/media/embed.ts';
	import { PROVIDER_LABELS } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const album = $derived(data.album);
	/** Texts from the Portofolio page's "Halaman album" card */
	const copy = $derived(
		data.copy as {
			othersHeading: string;
			button: { label: string; href: string };
			playLabel: string;
		}
	);
	const cover = $derived(album.cover ? data.media[album.cover] : undefined);
	const entries = $derived(
		album.items.map((it) => ({ ...it, m: data.media[it.media] })).filter((e) => e.m !== undefined)
	);
	// Photos in the lightbox, in album order
	const photos = $derived(
		entries
			.filter((e) => e.m.kind === 'image')
			.map((e) => ({ src: e.m.src!, srcset: e.m.srcset, alt: e.m.alt, caption: e.caption }))
	);

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);
	// Embeds load only after a click (privacy + speed)
	let loaded = $state<Record<string, boolean>>({});

	function openPhoto(mediaId: string) {
		lightboxIndex = entries
			.filter((e) => e.m.kind === 'image')
			.findIndex((e) => e.media === mediaId);
		lightboxOpen = true;
	}

	const meta = $derived(
		[album.eventDate ? dateID(album.eventDate, 'long') : null, album.venue, album.city]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<article>
	<header
		class="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-forest text-cream"
	>
		<CoverImage
			media={cover}
			sizes="100vw"
			priority
			class="absolute inset-0 -z-10 size-full object-cover opacity-80"
		/>
		<div
			class="absolute inset-0 -z-10 bg-linear-to-t from-forest/85 via-forest/30 to-transparent"
		></div>
		<div class="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 pb-12 lg:px-10">
			<p class="eyebrow text-cream/90">
				{EVENT_TYPE_LABEL[album.eventType as EventType] ?? album.eventType}
			</p>
			<h1 class="font-display text-display italic">{album.title}</h1>
			{#if meta}<p class="text-lead text-cream/90">{meta}</p>{/if}
		</div>
	</header>

	{#if album.story}
		<section class="section-pad">
			<div class="mx-auto flex max-w-[60ch] flex-col gap-4 text-lead">
				{#each paragraphs(album.story) as p, i (i)}<p>{p}</p>{/each}
			</div>
		</section>
	{/if}

	<section aria-label="Foto dan video" class="mx-auto max-w-6xl px-5 pb-20 lg:px-10">
		<ul class="columns-2 gap-3 md:columns-3 [&>li]:mb-3">
			{#each entries as e (e.media)}
				<li class="break-inside-avoid">
					<figure class="flex flex-col gap-1.5">
						{#if e.m.kind === 'image'}
							<button
								type="button"
								class="block w-full overflow-hidden"
								aria-label="Perbesar foto: {e.m.alt || e.caption || album.title}"
								onclick={() => openPhoto(e.media)}
							>
								<img
									src={e.m.thumb}
									srcset={e.m.srcset ?? undefined}
									sizes="(min-width: 48rem) 33vw, 50vw"
									alt={e.m.alt}
									width={e.m.width}
									height={e.m.height}
									loading="lazy"
									class="w-full transition-transform duration-300 hover:scale-[1.03] motion-reduce:transition-none"
								/>
							</button>
						{:else if e.m.kind === 'video'}
							<video
								src={e.m.src}
								poster={e.m.poster ?? undefined}
								controls
								muted
								playsinline
								preload="none"
								width={e.m.width}
								height={e.m.height}
								class="w-full bg-forest"
								aria-label={e.caption || `Video ${album.title}`}
							></video>
						{:else}
							{@const src = embedSrc(e.m.embedProvider, e.m.embedUrl)}
							<div class="w-full bg-sage-20" style:aspect-ratio={embedAspect(e.m.embedProvider)}>
								{#if loaded[e.media] && src}
									<iframe
										{src}
										title="{PROVIDER_LABELS[e.m.embedProvider!]}: {e.caption || album.title}"
										class="size-full"
										loading="lazy"
										allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
									></iframe>
								{:else}
									<button
										type="button"
										class="relative isolate flex size-full flex-col items-center justify-center gap-3 overflow-hidden text-forest"
										onclick={() => (loaded[e.media] = true)}
									>
										<!-- The provider's still behind the play button (YouTube only) -->
										<CoverImage
											media={e.m}
											sizes="(min-width: 48rem) 33vw, 50vw"
											class="absolute inset-0 -z-10 size-full object-cover"
										/>
										<span
											class="flex size-14 items-center justify-center rounded-full bg-forest text-cream"
											><Play size={22} aria-hidden="true" /></span
										>
										<span class="rounded-chip bg-cream/90 px-3 py-1 text-small font-semibold"
											>{copy.playLabel} {PROVIDER_LABELS[e.m.embedProvider!]}</span
										>
									</button>
								{/if}
							</div>
						{/if}
						{#if e.caption}<figcaption class="text-small text-ink-2">{e.caption}</figcaption>{/if}
					</figure>
				</li>
			{/each}
		</ul>
	</section>

	{#if data.others.length}
		<section aria-labelledby="lainnya" class="border-t border-sage section-pad">
			<div class="mx-auto flex max-w-6xl flex-col gap-6 px-5 lg:px-10">
				<h2 id="lainnya" class="font-display text-h2">{copy.othersHeading}</h2>
				<ul class="grid gap-5 sm:grid-cols-3">
					{#each data.others as o (o.id)}
						{@const c = o.cover ? data.media[o.cover] : undefined}
						<li>
							<a href={resolve('/(site)/portofolio/[slug]', { slug: o.slug })} class="group block">
								<span class="block aspect-4/5 overflow-hidden bg-sage-20">
									<CoverImage
										media={c}
										sizes="(min-width: 40rem) 30vw, 90vw"
										class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
									/>
								</span>
								<span class="mt-3 block font-display text-[1.375rem] italic">{o.title}</span>
							</a>
						</li>
					{/each}
				</ul>
				{#if copy.button.label && copy.button.href}
					<CmsLink href={copy.button.href} class="site-btn w-fit">{copy.button.label}</CmsLink>
				{/if}
			</div>
		</section>
	{/if}
</article>

<Lightbox {photos} bind:open={lightboxOpen} bind:index={lightboxIndex} />
