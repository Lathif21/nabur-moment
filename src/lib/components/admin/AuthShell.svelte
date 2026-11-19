<script lang="ts">
	import type { Snippet } from 'svelte';
	import Wordmark from '#lib/components/Wordmark.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- Logged-out admin pages (Masuk, Lupa kata sandi, Buat kata sandi baru): form left, forest panel
     right. The hero image comes from the CMS once it exists; until then a forest panel. -->
<div class="grid min-h-dvh bg-cream lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
	<main class="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
		<Wordmark tone="forest" size="sm" />

		<div class="flex flex-1 items-center py-10">
			{@render children()}
		</div>

		<p class="text-small text-ink-2">© Nabur Moment</p>
	</main>

	<aside
		class="relative hidden flex-col items-center justify-center gap-6 overflow-hidden bg-forest p-12 text-cream lg:flex"
		aria-hidden="true"
	>
		<p class="font-script text-script leading-none">Cerita kita</p>
		<p class="max-w-[28ch] text-center font-display text-h2 italic">
			Momen yang tak terulang, tersimpan rapi.
		</p>
	</aside>
</div>
