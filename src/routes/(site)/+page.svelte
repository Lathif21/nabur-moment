<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Hero, { type HeroMedia } from '#lib/components/site/sections/Hero.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const heroMedia = $derived.by((): HeroMedia => {
		const m = hero.data.media ? data.media[hero.data.media as string] : undefined;
		if (m?.kind === 'video') return { kind: 'video', src: m.src!, poster: m.poster };
		if (m?.kind === 'image')
			return {
				kind: 'image',
				src: m.src!,
				srcset: m.srcset,
				alt: m.alt,
				focalX: m.focalX,
				focalY: m.focalY
			};
		// Nothing chosen yet: the free stock clip (Mixkit #5223, see MEDIA-CREDITS.md)
		return { kind: 'video', src: asset('media/hero.mp4'), poster: asset('media/hero-poster.webp') };
	});
</script>

<!-- Beranda from the CMS. Only the hero is rendered so far; the other sections arrive in P1-06. -->
<svelte:head>
	<title>Nabur Moment</title>
	<meta name="description" content="Wedding content creator. Situs sedang disiapkan." />
</svelte:head>

{#if hero.visible}
	<Hero
		media={heroMedia}
		script={hero.data.script as string}
		headline={hero.data.headline as string}
		accent={hero.data.accent as string}
		caption={hero.data.caption as string}
		mono={hero.data.tone !== 'color'}
		next="lanjut"
	/>
{/if}

<section id="lanjut" class="scroll-mt-4 section-pad">
	<div class="mx-auto flex max-w-[60ch] flex-col items-center gap-6 text-center">
		<p class="eyebrow text-olive">Segera hadir</p>
		<h2 class="font-display text-h2">Situs kami sedang <em>disiapkan</em></h2>
		<p class="text-lead">
			Sementara itu, ceritakan rencana hari bahagia Anda. Kami akan menghubungi Anda melalui
			WhatsApp.
		</p>
		<a href={resolve('booking')} class="site-btn">Booking sekarang</a>
		<a
			href={resolve('paket')}
			class="inline-flex items-center gap-2 eyebrow underline underline-offset-8"
		>
			Lihat paket <ArrowRight size={16} aria-hidden="true" />
		</a>
	</div>
</section>
