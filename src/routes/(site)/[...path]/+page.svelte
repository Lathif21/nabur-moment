<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} · Nabur Moment</title>
</svelte:head>

<section class="border-t border-sage section-pad">
	<div class="mx-auto flex max-w-[60ch] flex-col items-center gap-5 text-center">
		<p class="eyebrow text-olive">Segera hadir</p>
		<h1 class="font-display text-h1">{data.title}</h1>
		<p class="text-lead">Halaman ini sedang disiapkan.</p>
	</div>
</section>
