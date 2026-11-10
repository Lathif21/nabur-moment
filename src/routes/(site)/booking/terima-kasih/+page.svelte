<script lang="ts">
	import CmsLink from '#lib/components/site/CmsLink.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const thanks = $derived(data.sections.thanks);
	const button = $derived(thanks.data.button as { label: string; href: string });
</script>

<section class="border-t border-sage section-pad">
	<div class="mx-auto flex max-w-[60ch] flex-col items-center gap-6 text-center">
		{#if thanks.data.script}
			<p class="font-script text-script text-olive" aria-hidden="true">{thanks.data.script}</p>
		{/if}
		<h1 class="font-display text-h1">{thanks.data.headline}</h1>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
		<div class="prose-site text-lead">{@html thanks.data.body}</div>
		{#if button.label && button.href}
			<CmsLink href={button.href} class="site-btn site-btn--outline">{button.label}</CmsLink>
		{/if}
	</div>
</section>
