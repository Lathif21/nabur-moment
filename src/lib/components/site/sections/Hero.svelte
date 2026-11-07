<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import { MediaQuery } from 'svelte/reactivity';
	// The hero text fonts, preloaded so the first screen does not wait for the CSS to find them
	import pinyon from '@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff2?url';
	import playfair from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
	import playfairItalic from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';

	// Props mirror the CMS `hero` section (03-SCREENS → Beranda #1).
	export type HeroMedia =
		| { kind: 'video'; src: string; poster: string | null }
		| {
				kind: 'image';
				src: string;
				srcset?: string | null;
				alt: string;
				/** Focal point 0–1, keeps the subject in frame when cropped */
				focalX?: number;
				focalY?: number;
		  };

	type Props = {
		media: HeroMedia;
		/** Script accent above the headline, 1–3 words */
		script?: string;
		/** Serif headline; `accent` is appended in italic */
		headline: string;
		accent?: string;
		/** Small tracked caption below the headline */
		caption?: string;
		/** Element id the "Gulir" cue scrolls to */
		next?: string;
		/** Black & white treatment, like the reference */
		mono?: boolean;
	};

	let { media, script, headline, accent, caption, next, mono = true }: Props = $props();

	const reducedMotion = new MediaQuery('prefers-reduced-motion: reduce');
	let video = $state<HTMLVideoElement>();
	let paused = $state(true);
	/**
	 * The clip's URL is set only after the page has loaded: the poster paints first and the video
	 * never competes with the page for bandwidth. Reduced motion or data saver: no download at all.
	 */
	let videoSrc = $state<string | undefined>();

	function wantsMotion() {
		const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
			?.saveData;
		return !reducedMotion.current && !saveData;
	}

	$effect(() => {
		if (media.kind !== 'video' || videoSrc || !wantsMotion()) return;
		const src = media.src;
		const start = () => (videoSrc = src);
		if (document.readyState === 'complete') start();
		else {
			addEventListener('load', start, { once: true });
			return () => removeEventListener('load', start);
		}
	});

	// No autoplay attribute: the clip only plays once we know motion is welcome (WCAG 2.3.3)
	$effect(() => {
		if (!video || !videoSrc) return;
		if (reducedMotion.current) video.pause();
		else video.play().catch(() => (paused = true));
	});

	function toggle() {
		if (!video) return;
		if (!videoSrc && media.kind === 'video') {
			// Not loaded yet (reduced motion / data saver): load it; the effect above plays it
			videoSrc = media.src;
			return;
		}
		if (video.paused) video.play().catch(() => (paused = true));
		else video.pause();
	}
</script>

<svelte:head>
	{#each [pinyon, playfair, playfairItalic] as href (href)}
		<link rel="preload" as="font" type="font/woff2" crossorigin="anonymous" {href} />
	{/each}
	{#if media.kind === 'video' && media.poster}
		<link rel="preload" as="image" href={media.poster} fetchpriority="high" />
	{/if}
</svelte:head>

<section
	class="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-forest px-5 pt-24 pb-28 text-center text-cream"
>
	{#if media.kind === 'video'}
		<video
			bind:this={video}
			class={['hero-media', mono && 'hero-media--mono']}
			src={videoSrc}
			poster={media.poster ?? undefined}
			muted
			loop
			playsinline
			preload="none"
			disablepictureinpicture
			aria-hidden="true"
			tabindex="-1"
			onplay={() => (paused = false)}
			onpause={() => (paused = true)}
		></video>
	{:else}
		<img
			class={['hero-media', mono && 'hero-media--mono']}
			src={media.src}
			srcset={media.srcset ?? undefined}
			sizes="100vw"
			alt={media.alt}
			fetchpriority="high"
			style:object-position="{(media.focalX ?? 0.5) * 100}% {(media.focalY ?? 0.5) * 100}%"
		/>
	{/if}
	<!-- Forest veil: darker at the top (header) and bottom (cue), lighter behind the words -->
	<div class="hero-veil" aria-hidden="true"></div>

	<div class="hero-copy flex max-w-5xl flex-col items-center">
		{#if script}
			<p class="font-script text-script text-cream/90">{script}</p>
		{/if}
		<h1 class={['font-display text-display', script && '-mt-3 lg:-mt-7']}>
			{headline}
			{#if accent}
				<em>{accent}</em>
			{/if}
		</h1>
		{#if caption}
			<p class="mt-6 eyebrow text-cream/90">{caption}</p>
		{/if}
	</div>

	{#if media.kind === 'video'}
		<button
			type="button"
			class="absolute bottom-6 left-5 inline-flex size-11 items-center justify-center rounded-full border border-cream/40 text-cream/90 transition-colors hover:bg-cream/10 lg:left-10"
			aria-label={paused ? 'Putar video latar' : 'Jeda video latar'}
			onclick={toggle}
		>
			{#if paused}<Play size={16} aria-hidden="true" />{:else}<Pause
					size={16}
					aria-hidden="true"
				/>{/if}
		</button>
	{/if}

	{#if next}
		<a
			href="#{next}"
			class="absolute right-5 bottom-6 flex flex-col items-center gap-3 text-cream/90 hover:text-cream lg:right-10"
		>
			<span class="hero-cue-line" aria-hidden="true"></span>
			<span class="font-display text-caption tracking-[0.16em] uppercase italic">Gulir</span>
		</a>
	{/if}
</section>

<style>
	.hero-media {
		position: absolute;
		inset: 0;
		z-index: -2;
		width: 100%;
		height: 100%;
		object-fit: cover;
		/* Subject (hands) sits left of centre in the stock clip; CMS focal point replaces this */
		object-position: 35% 50%;
	}
	.hero-media--mono {
		filter: grayscale(1) contrast(1.2) brightness(0.62);
	}
	.hero-veil {
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(
			to bottom,
			color-mix(in srgb, var(--color-forest) 55%, transparent) 0%,
			color-mix(in srgb, var(--color-forest) 20%, transparent) 35%,
			color-mix(in srgb, var(--color-forest) 25%, transparent) 65%,
			color-mix(in srgb, var(--color-forest) 75%, transparent) 100%
		);
	}
	.hero-copy > :global(*) {
		animation: hero-rise 900ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	.hero-copy > :global(:nth-child(2)) {
		animation-delay: 150ms;
	}
	.hero-copy > :global(:nth-child(3)) {
		animation-delay: 300ms;
	}
	.hero-cue-line {
		display: block;
		width: 1px;
		height: 3.5rem;
		background: currentColor;
		transform-origin: top;
		animation: hero-cue 2.4s ease-in-out infinite;
	}
	/* Movement only: starting from opacity 0 would hold back the largest paint (LCP) */
	@keyframes hero-rise {
		from {
			translate: 0 16px;
		}
	}
	@keyframes hero-cue {
		0% {
			scale: 1 0;
		}
		50% {
			scale: 1 1;
		}
		100% {
			scale: 1 1;
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hero-copy > :global(*),
		.hero-cue-line {
			animation: none;
		}
	}
</style>
