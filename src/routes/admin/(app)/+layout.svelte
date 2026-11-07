<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { MediaQuery } from 'svelte/reactivity';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import AdminNav from '#lib/components/admin/AdminNav.svelte';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let menuOpen = $state(false);
	const desktop = new MediaQuery('min-width: 64rem');

	// The phone menu has no use once the sidebar is on screen
	$effect(() => {
		if (desktop.current) menuOpen = false;
	});
</script>

<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Guarded by +layout.server.ts (session; permissions from P0-05). Each page renders a PageHeader in page-body. -->
<div class="min-h-dvh text-body lg:flex">
	<aside class="sticky top-0 hidden h-dvh w-(--size-sidebar) shrink-0 lg:block">
		<AdminNav user={data.user} perms={data.perms} />
	</aside>

	<header
		class="sticky top-0 z-30 flex h-14 items-center justify-between bg-forest px-2 text-cream lg:hidden"
	>
		<button
			type="button"
			class="icon-btn text-cream hover:bg-forest-90"
			aria-label="Buka menu"
			onclick={() => (menuOpen = true)}
		>
			<Menu size={22} strokeWidth={1.75} aria-hidden="true" />
		</button>
		<Wordmark tone="cream" size="sm" />
		<span class="size-10" aria-hidden="true"></span>
	</header>

	<Dialog.Root bind:open={menuOpen}>
		<Dialog.Portal>
			<Dialog.Overlay class="fixed inset-0 z-40 bg-forest/40 lg:hidden" />
			<Dialog.Content
				class="fixed inset-y-0 left-0 z-50 w-[min(var(--size-sidebar),85vw)] shadow-modal lg:hidden"
			>
				<Dialog.Title class="sr-only">Menu admin</Dialog.Title>
				<Dialog.Close
					type="button"
					class="icon-btn absolute top-2 right-2 z-10 text-cream hover:bg-forest-90"
					aria-label="Tutup menu"
				>
					<X size={20} strokeWidth={1.75} aria-hidden="true" />
				</Dialog.Close>
				<AdminNav user={data.user} perms={data.perms} onnavigate={() => (menuOpen = false)} />
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>

	<main class="min-w-0 flex-1">
		{@render children()}
	</main>
</div>
