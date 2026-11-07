<script lang="ts">
	import { paragraphs } from '#lib/cms/lists.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const intro = $derived(data.sections.intro);
</script>

<!-- FAQ from the CMS: intro section + published FAQ list. P1-06 adds the accordion design. -->
<svelte:head>
	<title>FAQ · {data.site.businessName}</title>
</svelte:head>

<section class="border-t border-sage section-pad">
	<div class="mx-auto flex max-w-3xl flex-col gap-10">
		{#if intro.visible}
			<header class="flex flex-col gap-4 text-center">
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<h1 class="font-display text-h1">{intro.data.headline}</h1>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="text-lead">{@html intro.data.body}</div>
			</header>
		{:else}
			<h1 class="text-center font-display text-h1">FAQ</h1>
		{/if}

		{#if data.faq.length}
			<div class="flex flex-col divide-y divide-sage border-y border-sage">
				{#each data.faq as item (item.id)}
					<details class="group py-5">
						<summary class="cursor-pointer font-display text-[1.25rem] marker:text-olive">
							{item.question}
						</summary>
						<div class="mt-3 flex flex-col gap-3 text-lead">
							{#each paragraphs(item.answer) as p, i (i)}<p>{p}</p>{/each}
						</div>
					</details>
				{/each}
			</div>
		{:else}
			<p class="text-center text-lead text-ink-2">Belum ada pertanyaan.</p>
		{/if}
	</div>
</section>
