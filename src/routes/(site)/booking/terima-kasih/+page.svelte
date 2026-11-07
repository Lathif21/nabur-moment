<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const thanks = $derived(data.sections.thanks);
</script>

<svelte:head>
	<title>Terima kasih · {data.site.businessName}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="border-t border-sage section-pad">
	<div class="mx-auto flex max-w-[60ch] flex-col items-center gap-6 text-center">
		<p class="font-script text-script text-olive" aria-hidden="true">Terima kasih</p>
		<h1 class="font-display text-h1">{thanks.data.headline}</h1>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
		<div class="prose-site text-lead">{@html thanks.data.body}</div>
		<a href={resolve('portofolio')} class="site-btn site-btn--outline">Lihat portofolio</a>
	</div>
</section>
