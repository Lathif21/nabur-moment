<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import CmsLink from './CmsLink.svelte';
	import Logo from './Logo.svelte';
	import type { SiteLink } from '#lib/cms/site-settings.ts';

	type Props = {
		/** Transparent with cream text over a dark hero photo; otherwise cream bar with forest text */
		overlay?: boolean;
		/** Business name (logo alt text) */
		name: string;
		/** Uploaded logos from site settings: light for dark backgrounds, dark for light ones */
		logoLight: string | null;
		logoDark: string | null;
		/** Menu from site settings (only entries with a label and a link) */
		nav: SiteLink[];
		/** Header button; hidden when its label or link is empty */
		button: SiteLink;
	};

	let { overlay = false, name, logoLight, logoDark, nav, button }: Props = $props();
	let menuOpen = $state(false);

	// Menu links are CMS hrefs ("/tentang"); the trailing slash is optional
	const current = (href: string) =>
		href.startsWith('/') && page.url.pathname.replace(/\/$/, '') === href.replace(/\/$/, '');
	const showButton = $derived(!!(button.label && button.href));
</script>

<header
	class={[
		'z-30 w-full',
		overlay ? 'absolute inset-x-0 top-0 text-cream' : 'relative bg-cream text-forest'
	]}
>
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:h-24 lg:px-10">
		<a href={resolve('')} aria-label="{name}, ke beranda">
			<Logo src={overlay ? logoLight : logoDark} {name} tone={overlay ? 'cream' : 'forest'} />
		</a>

		<nav aria-label="Menu utama" class="hidden items-center gap-8 lg:flex">
			{#each nav as item, i (i)}
				<CmsLink
					href={item.href}
					aria-current={current(item.href) ? 'page' : undefined}
					class="py-2 eyebrow underline-offset-8 hover:underline aria-[current=page]:underline"
					>{item.label}</CmsLink
				>
			{/each}
			{#if showButton}
				<CmsLink
					href={button.href}
					class={['site-btn', overlay ? 'site-btn--inverse' : '']}
					aria-current={current(button.href) ? 'page' : undefined}>{button.label}</CmsLink
				>
			{/if}
		</nav>

		<button
			type="button"
			class="-mr-2 inline-flex size-11 items-center justify-center lg:hidden"
			aria-label="Buka menu"
			onclick={() => (menuOpen = true)}
		>
			<Menu size={26} strokeWidth={1.5} aria-hidden="true" />
		</button>
	</div>
</header>

<!-- Phone: full-screen menu on forest -->
<Dialog.Root bind:open={menuOpen}>
	<Dialog.Portal>
		<Dialog.Content class="fixed inset-0 z-50 flex flex-col bg-forest text-cream lg:hidden">
			<Dialog.Title class="sr-only">Menu</Dialog.Title>
			<div class="flex h-20 items-center justify-between px-5">
				<Logo src={logoLight} {name} tone="cream" />
				<Dialog.Close
					type="button"
					class="-mr-2 inline-flex size-11 items-center justify-center"
					aria-label="Tutup menu"
				>
					<X size={26} strokeWidth={1.5} aria-hidden="true" />
				</Dialog.Close>
			</div>
			<nav aria-label="Menu utama" class="flex flex-1 flex-col justify-center gap-2 px-8">
				{#each nav as item, i (i)}
					<CmsLink
						href={item.href}
						aria-current={current(item.href) ? 'page' : undefined}
						class="py-2 font-display text-h2 aria-[current=page]:italic"
						onclick={() => (menuOpen = false)}>{item.label}</CmsLink
					>
				{/each}
				{#if showButton}
					<CmsLink
						href={button.href}
						class="site-btn site-btn--inverse mt-8 self-start"
						onclick={() => (menuOpen = false)}>{button.label}</CmsLink
					>
				{/if}
			</nav>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
