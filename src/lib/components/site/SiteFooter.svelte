<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import { bookingHref, siteNav } from '#lib/nav.ts';

	// Placeholder content: line, socials and contacts come from published site settings in P1-04.
	const line = 'Mengabadikan momen pernikahan dengan hangat, candid, dan estetik.';
	const socials = [
		{ label: 'Instagram', href: 'https://instagram.com/' },
		{ label: 'TikTok', href: 'https://tiktok.com/' },
		{ label: 'WhatsApp', href: 'https://wa.me/' },
		{ label: 'Email', href: 'mailto:halo@example.com' }
	];
	const year = new Date().getFullYear();
</script>

<footer class="bg-forest text-cream">
	<div class="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-3 lg:px-10 lg:py-20">
		<div class="flex flex-col items-start gap-5">
			<Wordmark tone="cream" size="md" />
			<p class="max-w-[36ch] text-lead">{line}</p>
		</div>

		<nav aria-label="Menu footer" class="flex flex-col gap-3">
			<p class="eyebrow text-cream/80">Menu</p>
			{#each siteNav as item (item.href)}
				<a href={resolve(item.href)} class="w-fit hover:underline">{item.label}</a>
			{/each}
		</nav>

		<div class="flex flex-col gap-3">
			<p class="eyebrow text-cream/80">Ikuti kami</p>
			{#each socials as s (s.label)}
				<a href={s.href} class="w-fit hover:underline" rel="noopener" target="_blank"
					>{s.label}<span class="sr-only"> (tab baru)</span></a
				>
			{/each}
			<a
				href={resolve(bookingHref)}
				class="mt-4 inline-flex w-fit items-center gap-2 eyebrow underline-offset-8 hover:underline"
			>
				Pesan sekarang <ArrowRight size={16} aria-hidden="true" />
			</a>
		</div>
	</div>
	<div class="border-t border-cream/15">
		<p class="mx-auto max-w-7xl px-5 py-6 text-caption tracking-[0.16em] uppercase lg:px-10">
			© {year} Nabur Moment
		</p>
	</div>
</footer>
