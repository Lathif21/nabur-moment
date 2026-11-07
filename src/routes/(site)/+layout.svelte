<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Path } from '$app/types';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Pages that open with a full-bleed dark hero return { headerOverlay: true } from their load
	const overlay = $derived(page.data.headerOverlay === true);
	// Drafts are on screen (?preview=1 with an admin session)
	const preview = $derived(page.data.preview === true);

	const site = $derived(data.site);
	const src = (id: string | null) => (id ? (data.siteMedia[id]?.src ?? null) : null);
	const logoLight = $derived(src(site.logoLight));
	const logoDark = $derived(src(site.logoDark));
	const shareImage = $derived(src(site.shareImage));
</script>

<!-- Site-wide defaults from published settings; pages add their own title (per-page SEO in P1-09) -->
<svelte:head>
	<meta name="description" content={site.seoDescription} />
	<meta property="og:site_name" content={site.businessName} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="id_ID" />
	<meta property="og:title" content={site.seoTitle} />
	<meta property="og:description" content={site.seoDescription} />
	{#if shareImage}
		<meta property="og:image" content={shareImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>

<a
	href="#konten"
	class="sr-only z-50 bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>Lewati ke konten</a
>

<div class="flex min-h-dvh flex-col">
	<SiteHeader {overlay} name={site.businessName} {logoLight} {logoDark} />
	<main id="konten" class="flex-1">
		{@render children()}
	</main>
	<SiteFooter {site} logo={logoLight} />
</div>

{#if preview}
	<div
		role="status"
		class="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-warning-bg px-4 py-2 text-center text-small font-semibold text-warning shadow-modal"
	>
		Pratinjau draf: pengunjung belum melihat perubahan ini.
		<a href={resolve(page.url.pathname.slice(1) as Path)} class="underline underline-offset-2"
			>Lihat versi terbit</a
		>
	</div>
{/if}
