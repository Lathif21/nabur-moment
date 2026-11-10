<script lang="ts">
	import CmsImage from '../CmsImage.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Member = { photo: MediaItem | undefined; name: string; role: string; bio: string };
	type Props = { heading: string; members: Member[] };

	let { heading, members }: Props = $props();
</script>

<section class="section-pad" aria-labelledby="team-title">
	<div class="mx-auto flex max-w-6xl flex-col gap-12 px-5 lg:px-10">
		<h2 id="team-title" class="text-center font-display text-h2">{heading}</h2>
		<ul class="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
			{#each members as p, i (i)}
				<li class="flex flex-col gap-3">
					<span class="block aspect-4/5 overflow-hidden bg-sage-20">
						<CmsImage
							media={p.photo}
							sizes="(min-width: 64rem) 30vw, (min-width: 40rem) 45vw, 90vw"
							class="size-full object-cover"
						/>
					</span>
					<h3 class="font-display text-[1.5rem] italic">{p.name}</h3>
					{#if p.role}<p class="eyebrow text-olive">{p.role}</p>{/if}
					{#if p.bio}<p class="text-lead">{p.bio}</p>{/if}
				</li>
			{/each}
		</ul>
	</div>
</section>
