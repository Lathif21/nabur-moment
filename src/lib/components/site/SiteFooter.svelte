<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Logo from './Logo.svelte';
	import { socialUrl, type SiteSettings } from '#lib/cms/site-settings.ts';
	import { bookingHref, siteNav } from '#lib/nav.ts';

	type Props = {
		/** Published site settings */
		site: SiteSettings;
		/** Uploaded light logo (footer is forest), or null for the typeset one */
		logo: string | null;
	};

	let { site, logo }: Props = $props();

	const links = $derived(
		[
			{ label: 'Instagram', href: socialUrl('instagram', site.instagram) },
			{ label: 'TikTok', href: socialUrl('tiktok', site.tiktok) },
			{ label: 'WhatsApp', href: site.whatsapp ? `https://wa.me/${site.whatsapp}` : null },
			{ label: 'Email', href: site.email ? `mailto:${site.email}` : null }
		].filter((l): l is { label: string; href: string } => !!l.href)
	);
	const year = new Date().getFullYear();
</script>

<footer class="bg-forest text-cream">
	<div class="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-3 lg:px-10 lg:py-20">
		<div class="flex flex-col items-start gap-5">
			<Logo src={logo} name={site.businessName} tone="cream" size="md" />
			{#if site.footerText}<p class="max-w-[36ch] text-lead">{site.footerText}</p>{/if}
		</div>

		<nav aria-label="Menu footer" class="flex flex-col gap-3">
			<p class="eyebrow text-cream/80">Menu</p>
			{#each siteNav as item (item.href)}
				<a href={resolve(item.href)} class="w-fit hover:underline">{item.label}</a>
			{/each}
		</nav>

		<div class="flex flex-col gap-3">
			{#if links.length}
				<p class="eyebrow text-cream/80">Ikuti kami</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- social profiles, WhatsApp and email from site settings -->
				{#each links as l (l.label)}
					<a
						href={l.href}
						class="w-fit hover:underline"
						rel="noopener noreferrer"
						target={l.href.startsWith('mailto:') ? undefined : '_blank'}
						>{l.label}{#if !l.href.startsWith('mailto:')}<span class="sr-only">
								(tab baru)</span
							>{/if}</a
					>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
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
			© {year}
			{site.businessName}
		</p>
	</div>
</footer>
