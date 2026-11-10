<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Path } from '$app/types';
	import SiteFooter from '#lib/components/site/SiteFooter.svelte';
	import SiteHeader from '#lib/components/site/SiteHeader.svelte';
	import { menuLinks } from '#lib/cms/site-settings.ts';
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

	// Page meta (CMS SEO card, album, …) over the site defaults (Pengaturan → Situs)
	type Meta = { title: string; description: string; image: string; noindex?: boolean };
	const meta = $derived((page.data.meta ?? {}) as Partial<Meta>);
	const title = $derived(meta.title ? `${meta.title} · ${site.businessName}` : site.seoTitle);
	const description = $derived(meta.description || site.seoDescription);
	const image = $derived(meta.image || shareImage);
	const canonical = $derived(data.origin + page.url.pathname);
</script>

<!-- One place for every public page's title, description, canonical and share preview (P1-09) -->
<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	{#if meta.noindex || preview}<meta name="robots" content="noindex" />{/if}
	<meta property="og:site_name" content={site.businessName} />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="id_ID" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	{#if image}
		<meta property="og:image" content={image} />
		<meta name="twitter:card" content="summary_large_image" />
	{:else}
		<meta name="twitter:card" content="summary" />
	{/if}
</svelte:head>

<a
	href="#konten"
	class="sr-only z-50 bg-forest px-4 py-2 text-cream focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
	>Lewati ke konten</a
>

<div class="flex min-h-dvh flex-col">
	<SiteHeader
		{overlay}
		name={site.businessName}
		{logoLight}
		{logoDark}
		nav={menuLinks(site.nav)}
		button={site.navButton}
	/>
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
