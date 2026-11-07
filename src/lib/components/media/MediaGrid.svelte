<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Play from '@lucide/svelte/icons/play';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { duration, KIND_LABELS, PROVIDER_LABELS, type MediaItem } from '#lib/media/types.ts';

	type Props = {
		items: MediaItem[];
		onpick: (item: MediaItem) => void;
		/** Picker mode: ticked items */
		selected?: string[];
	};

	let { items, onpick, selected }: Props = $props();

	function label(m: MediaItem) {
		const name =
			m.kind === 'embed' ? `${PROVIDER_LABELS[m.embedProvider!]} ${m.embedUrl}` : m.filename;
		return `${KIND_LABELS[m.kind]}: ${m.alt || name || 'tanpa nama'}`;
	}
</script>

<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Media">
	{#each items as m (m.id)}
		{@const on = selected?.includes(m.id)}
		<li>
			<button
				type="button"
				class={[
					'group relative block aspect-square w-full overflow-hidden rounded-card border bg-sage-20 text-left',
					on ? 'border-olive ring-2 ring-olive' : 'border-line'
				]}
				aria-label={label(m)}
				aria-pressed={selected ? on : undefined}
				onclick={() => onpick(m)}
			>
				{#if m.thumb}
					<img
						src={m.thumb}
						alt=""
						loading="lazy"
						class="size-full object-cover transition-transform group-hover:scale-[1.03]"
						style:object-position="{m.focalX * 100}% {m.focalY * 100}%"
					/>
				{:else}
					<span class="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
						<Link2 size={22} strokeWidth={1.5} aria-hidden="true" />
						<span class="text-small font-semibold">{PROVIDER_LABELS[m.embedProvider!]}</span>
						<span class="line-clamp-2 text-[0.6875rem] break-all text-ink-2">{m.embedUrl}</span>
					</span>
				{/if}

				{#if m.kind === 'video'}
					<span
						class="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-chip bg-forest/80 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-cream"
					>
						<Play size={11} aria-hidden="true" />{duration(m.durationS)}
					</span>
				{/if}
				{#if m.kind === 'image' && !m.alt}
					<span
						class="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-chip bg-warning-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold text-warning"
					>
						<TriangleAlert size={11} aria-hidden="true" />Tanpa alt
					</span>
				{/if}
				{#if on}
					<span
						class="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-olive text-cream"
					>
						<Check size={14} aria-hidden="true" />
					</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>
