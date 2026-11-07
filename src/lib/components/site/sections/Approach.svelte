<script lang="ts">
	type Props = { heading: string; blocks: { title: string; text: string }[] };

	let { heading, blocks }: Props = $props();
</script>

<section class="bg-sage-20 section-pad" aria-labelledby="approach-title">
	<div class="mx-auto flex max-w-6xl flex-col gap-12 px-5 lg:px-10">
		<h2 id="approach-title" class="text-center font-display text-h2">{heading}</h2>
		<ol class="grid gap-10 md:grid-cols-3">
			{#each blocks as b, i (i)}
				<li class="flex flex-col gap-3">
					<span class="font-display text-[2.5rem] text-olive lining-nums" aria-hidden="true"
						>0{i + 1}</span
					>
					<h3 class="font-display text-[1.5rem]">{b.title}</h3>
					<p class="text-lead">{b.text}</p>
				</li>
			{/each}
		</ol>
	</div>
</section>
