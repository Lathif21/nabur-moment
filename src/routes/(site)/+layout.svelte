<script lang="ts">
	import { page } from '$app/state';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	// Pages that open with a full-bleed dark hero return { headerOverlay: true } from their load
	const overlay = $derived(page.data.headerOverlay === true);
</script>

<a
	href="#konten"
	class="sr-only z-50 bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>Lewati ke konten</a
>

<div class="flex min-h-dvh flex-col">
	<SiteHeader {overlay} />
	<main id="konten" class="flex-1">
		{@render children()}
	</main>
	<SiteFooter />
</div>
