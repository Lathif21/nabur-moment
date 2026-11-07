<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
</script>

<!-- Placeholder Beranda until the CMS-driven sections (P1-06). Shows the type and colour system. -->
<svelte:head>
	<title>Nabur Moment</title>
	<meta name="description" content="Wedding content creator. Situs sedang disiapkan." />
</svelte:head>

<section
	class="relative flex min-h-[92dvh] flex-col items-center justify-center bg-forest px-5 pt-24 pb-16 text-center text-cream"
>
	<p class="font-script text-script text-cream/90">Cerita kita</p>
	<h1 class="-mt-4 font-display text-display lg:-mt-8">
		Momen yang <em>tak terulang</em>
	</h1>
	<p class="mt-6 eyebrow">Wedding content creator</p>
	<p class="absolute bottom-8 text-caption tracking-[0.16em] uppercase" aria-hidden="true">Gulir</p>
</section>

<section class="section-pad">
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
