<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Hero from '#lib/components/site/sections/Hero.svelte';
</script>

<!-- Placeholder Beranda until the CMS-driven sections (P1-06). The hero clip is a free stock video
     (Mixkit #5223, Mixkit Stock Video Free License) until she uploads her own. -->
<svelte:head>
	<title>Nabur Moment</title>
	<meta name="description" content="Wedding content creator. Situs sedang disiapkan." />
</svelte:head>

<Hero
	media={{ kind: 'video', src: asset('media/hero.mp4'), poster: asset('media/hero-poster.webp') }}
	script="Cerita kita"
	headline="Momen yang"
	accent="tak terulang"
	caption="Wedding content creator"
	next="lanjut"
/>

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
