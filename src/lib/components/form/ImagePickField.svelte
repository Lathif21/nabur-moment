<script lang="ts">
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import MediaPicker from '#lib/components/media/MediaPicker.svelte';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		/** Form field name; posts the media id (empty when none) */
		name: string;
		label: string;
		/** Chosen media id */
		value: string | null;
		/** Known media by id (thumbnails) */
		media: Record<string, MediaItem>;
		hint?: string;
	};

	let { name, label, value = $bindable(), media, hint }: Props = $props();
	let open = $state(false);
	const chosen = $derived(value ? media[value] : undefined);
</script>

<!-- One image from the media library inside a regular form -->
<div class="field" role="group" aria-labelledby="{name}-label">
	<span id="{name}-label" class="text-small font-semibold">{label}</span>
	<input type="hidden" {name} value={value ?? ''} />
	<div class="flex items-center gap-3">
		{#if value}
			<span class="relative size-20 shrink-0 overflow-hidden rounded-card bg-sage-20">
				{#if chosen?.thumb}
					<img
						src={chosen.thumb}
						alt=""
						class="size-full object-cover"
						style:object-position="{chosen.focalX * 100}% {chosen.focalY * 100}%"
					/>
				{/if}
				{#if chosen && !chosen.alt}
					<span
						class="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-chip bg-warning-bg px-1 text-[0.625rem] font-semibold text-warning"
						><TriangleAlert size={10} aria-hidden="true" />alt</span
					>
				{/if}
			</span>
		{/if}
		<div class="flex flex-wrap gap-1.5">
			<button type="button" class="btn btn--secondary btn--sm" onclick={() => (open = true)}>
				<ImagePlus size={14} aria-hidden="true" />
				{value ? 'Ganti' : 'Pilih'} <span class="sr-only">{label}</span>
			</button>
			{#if value}
				<button type="button" class="btn btn--ghost btn--sm" onclick={() => (value = null)}>
					Hapus <span class="sr-only">{label}</span>
				</button>
			{/if}
		</div>
	</div>
	{#if hint}<p class="field__hint">{hint}</p>{/if}
</div>

<MediaPicker
	bind:open
	title={label}
	kinds={['image']}
	value={value ? [value] : []}
	onselect={(ids, items) => {
		for (const m of items) media[m.id] = m;
		value = ids[0] ?? null;
	}}
/>
