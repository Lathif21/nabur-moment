<script lang="ts">
	type Props = { words: string[] };

	let { words }: Props = $props();
	// Enough copies to fill wide screens; the second half makes the loop seamless
	const run = $derived(Array.from({ length: 4 }, () => words).flat());
</script>

<!-- Keyword band (contentlywed); static under prefers-reduced-motion -->
<section class="overflow-hidden border-y border-sage bg-cream py-6" aria-label={words.join(', ')}>
	<div class="ticker flex w-max" aria-hidden="true">
		{#each [0, 1] as half (half)}
			<ul class="flex shrink-0 items-center">
				{#each run as w, i (i)}
					<li class="flex items-center font-display text-h2 whitespace-nowrap italic">
						<span class="px-6">{w}</span><span class="text-olive">·</span>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
</section>

<style>
	.ticker {
		animation: ticker 40s linear infinite;
	}
	@keyframes ticker {
		to {
			translate: -50% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticker {
			animation: none;
		}
	}
</style>
