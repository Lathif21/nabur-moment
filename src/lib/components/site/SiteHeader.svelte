<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import { bookingHref, siteNav } from '#lib/nav.ts';

	type Props = {
		/** Transparent with cream text over a dark hero photo; otherwise cream bar with forest text */
		overlay?: boolean;
	};

	let { overlay = false }: Props = $props();
	let menuOpen = $state(false);

	const current = (href: string) => page.url.pathname === '/' + href;
</script>

<header
	class={[
		'z-30 w-full',
		overlay ? 'absolute inset-x-0 top-0 text-cream' : 'relative bg-cream text-forest'
	]}
>
	<div class="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:h-24 lg:px-10">
		<a href={resolve('')} aria-label="Nabur Moment, ke beranda">
			<Wordmark tone={overlay ? 'cream' : 'forest'} size="sm" />
		</a>

		<nav aria-label="Menu utama" class="hidden items-center gap-8 lg:flex">
			{#each siteNav as item (item.href)}
				<a
					href={resolve(item.href)}
					aria-current={current(item.href) ? 'page' : undefined}
					class="py-2 eyebrow underline-offset-8 hover:underline aria-[current=page]:underline"
					>{item.label}</a
				>
			{/each}
			<a
				href={resolve(bookingHref)}
				class={['site-btn', overlay ? 'site-btn--inverse' : '']}
				aria-current={current(bookingHref) ? 'page' : undefined}>Booking</a
			>
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
				<Wordmark tone="cream" size="sm" />
				<Dialog.Close
					type="button"
					class="-mr-2 inline-flex size-11 items-center justify-center"
					aria-label="Tutup menu"
				>
					<X size={26} strokeWidth={1.5} aria-hidden="true" />
				</Dialog.Close>
			</div>
			<nav aria-label="Menu utama" class="flex flex-1 flex-col justify-center gap-2 px-8">
				{#each siteNav as item (item.href)}
					<a
						href={resolve(item.href)}
						aria-current={current(item.href) ? 'page' : undefined}
						class="py-2 font-display text-h2 aria-[current=page]:italic"
						onclick={() => (menuOpen = false)}>{item.label}</a
					>
				{/each}
				<a
					href={resolve(bookingHref)}
					class="site-btn site-btn--inverse mt-8 self-start"
					onclick={() => (menuOpen = false)}>Booking</a
				>
			</nav>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
