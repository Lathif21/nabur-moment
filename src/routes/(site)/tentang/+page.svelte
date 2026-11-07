<script lang="ts">
	import Approach from '#lib/components/site/sections/Approach.svelte';
	import Cta from '#lib/components/site/sections/Cta.svelte';
	import Intro from '#lib/components/site/sections/Intro.svelte';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import Team from '#lib/components/site/sections/Team.svelte';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.sections);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
	const members = $derived(
		(s.team.data.members as { photo: string | null; name: string; role: string; bio: string }[])
			.filter((p) => p.name)
			.map((p) => ({ ...p, photo: m(p.photo) }))
	);
</script>

<svelte:head>
	<title>Tentang · {data.site.businessName}</title>
</svelte:head>

{#if s.hero.visible}
	<PageHero title={s.hero.data.title as string} image={m(s.hero.data.image)} eyebrow="Tentang" />
{:else}
	<h1 class="sr-only">Tentang {data.site.businessName}</h1>
{/if}

{#if s.story.visible}
	<Intro
		id="cerita"
		eyebrow={s.story.data.eyebrow as string}
		headline={s.story.data.headline as string}
		body={s.story.data.body as string}
		image={m(s.story.data.image)}
		flip
	/>
{/if}

{#if s.approach.visible}
	<Approach
		heading={s.approach.data.heading as string}
		blocks={(s.approach.data.blocks as { title: string; text: string }[]).filter((b) => b.title)}
	/>
{/if}

{#if s.team.visible && members.length}
	<Team {members} />
{/if}

{#if s.cta.visible}
	<Cta
		image={m(s.cta.data.image)}
		headline={s.cta.data.headline as string}
		button={s.cta.data.button as { label: string; href: string }}
	/>
{/if}
