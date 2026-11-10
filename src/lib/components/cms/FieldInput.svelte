<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Plus from '@lucide/svelte/icons/plus';
	import Play from '@lucide/svelte/icons/play';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import Self from './FieldInput.svelte';
	import RichTextEditor from './RichTextEditor.svelte';
	import MediaPicker from '#lib/components/media/MediaPicker.svelte';
	import type { Field } from '#lib/cms/sections.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	type Props = {
		field: Field;
		value: unknown;
		/** Known media by id (shared by the whole editor; the picker adds to it) */
		media: Record<string, MediaItem>;
		/** Unique id prefix for labels */
		id: string;
		disabled?: boolean;
	};

	let { field, value = $bindable(), media, id, disabled = false }: Props = $props();

	let pickerOpen = $state(false);

	function remember(items: MediaItem[]) {
		for (const m of items) media[m.id] = m;
	}

	function move<T>(list: T[], i: number, by: number) {
		const j = i + by;
		if (j < 0 || j >= list.length) return;
		[list[i], list[j]] = [list[j], list[i]];
	}

	function blankItem() {
		if (field.kind !== 'list') return {};
		return Object.fromEntries(
			field.fields.map((f) => [
				f.key,
				f.kind === 'image' ? null : f.kind === 'link' ? { label: '', href: '' } : ''
			])
		);
	}
</script>

{#snippet thumb(m: MediaItem | undefined, mediaId: string)}
	<span class="relative block size-full overflow-hidden rounded-card bg-sage-20">
		{#if m?.thumb}
			<img
				src={m.thumb}
				alt=""
				class="size-full object-cover"
				style:object-position="{m.focalX * 100}% {m.focalY * 100}%"
			/>
		{:else}
			<span
				class="flex size-full items-center justify-center p-2 text-center text-[0.6875rem] text-ink-2"
				>{m ? m.filename : `Media ${mediaId.slice(0, 8)}`}</span
			>
		{/if}
		{#if m?.kind === 'video'}
			<span class="absolute bottom-1 left-1 rounded-chip bg-forest/80 p-0.5 text-cream"
				><Play size={11} aria-hidden="true" /></span
			>
		{/if}
		{#if m?.kind === 'image' && !m.alt}
			<span
				class="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-chip bg-warning-bg px-1 text-[0.625rem] font-semibold text-warning"
				><TriangleAlert size={10} aria-hidden="true" />alt</span
			>
		{/if}
	</span>
{/snippet}

<div class="field">
	{#if field.kind === 'list' || field.kind === 'images' || field.kind === 'link' || field.kind === 'image' || field.kind === 'media'}
		<span id="{id}-label" class="text-small font-semibold">{field.label}</span>
	{:else}
		<label for={id}>{field.label}</label>
	{/if}

	{#if field.kind === 'text'}
		<input
			{id}
			class="input"
			maxlength={field.max ?? 160}
			placeholder={field.placeholder}
			{disabled}
			bind:value={value as string}
		/>
	{:else if field.kind === 'textarea'}
		<textarea
			{id}
			class="input min-h-24"
			maxlength={field.max ?? 1000}
			{disabled}
			bind:value={value as string}></textarea>
	{:else if field.kind === 'richtext'}
		<RichTextEditor bind:value={value as string} {id} label={field.label} {disabled} />
	{:else if field.kind === 'number'}
		<input
			{id}
			class="input w-28"
			type="number"
			min={field.min}
			max={field.max}
			{disabled}
			bind:value={value as number}
		/>
	{:else if field.kind === 'select'}
		<select {id} class="input w-fit" {disabled} bind:value={value as string}>
			{#each field.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
		</select>
	{:else if field.kind === 'link'}
		{@const link = value as { label: string; href: string }}
		<div class="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="{id}-label">
			<input
				class="input"
				aria-label="{field.label}: teks"
				placeholder="Teks tombol"
				maxlength="60"
				{disabled}
				bind:value={link.label}
			/>
			<input
				class="input"
				aria-label="{field.label}: tautan"
				placeholder="/booking atau https://…"
				maxlength="500"
				{disabled}
				bind:value={link.href}
			/>
		</div>
	{:else if field.kind === 'image' || field.kind === 'media'}
		{@const mediaId = value as string | null}
		<div class="flex items-center gap-3" role="group" aria-labelledby="{id}-label">
			{#if mediaId}
				<span class="size-20 shrink-0">{@render thumb(media[mediaId], mediaId)}</span>
			{/if}
			{#if !disabled}
				<div class="flex flex-wrap gap-1.5">
					<button
						type="button"
						class="btn btn--secondary btn--sm"
						onclick={() => (pickerOpen = true)}
					>
						<ImagePlus size={14} aria-hidden="true" />
						{mediaId ? 'Ganti' : 'Pilih'}
						<span class="sr-only">{field.label}</span>
					</button>
					{#if mediaId}
						<button type="button" class="btn btn--ghost btn--sm" onclick={() => (value = null)}>
							Hapus <span class="sr-only">{field.label}</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
		<MediaPicker
			bind:open={pickerOpen}
			title={field.label}
			kinds={field.kind === 'media' ? ['image', 'video'] : ['image']}
			value={mediaId ? [mediaId] : []}
			onselect={(ids, items) => {
				remember(items);
				value = ids[0] ?? null;
			}}
		/>
	{:else if field.kind === 'images'}
		{@const ids = value as string[]}
		<div class="flex flex-col gap-2" role="group" aria-labelledby="{id}-label">
			{#if ids.length}
				<ol class="grid grid-cols-3 gap-2 sm:grid-cols-5">
					{#each ids as mediaId, i (mediaId)}
						<li class="flex flex-col gap-1">
							<span class="aspect-square">{@render thumb(media[mediaId], mediaId)}</span>
							{#if !disabled}
								<span class="flex justify-center gap-0.5">
									<button
										type="button"
										class="icon-btn size-7!"
										aria-label="Geser foto {i + 1} ke kiri"
										disabled={i === 0}
										onclick={() => move(ids, i, -1)}
										><ArrowLeft size={13} aria-hidden="true" /></button
									>
									<button
										type="button"
										class="icon-btn size-7!"
										aria-label="Geser foto {i + 1} ke kanan"
										disabled={i === ids.length - 1}
										onclick={() => move(ids, i, 1)}
										><ArrowRight size={13} aria-hidden="true" /></button
									>
									<button
										type="button"
										class="icon-btn size-7!"
										aria-label="Lepas foto {i + 1}"
										onclick={() => ids.splice(i, 1)}><X size={13} aria-hidden="true" /></button
									>
								</span>
							{/if}
						</li>
					{/each}
				</ol>
			{/if}
			{#if !disabled && ids.length < (field.max ?? 24)}
				<button
					type="button"
					class="btn btn--secondary btn--sm w-fit"
					onclick={() => (pickerOpen = true)}
				>
					<ImagePlus size={14} aria-hidden="true" /> Pilih foto
					<span class="sr-only">{field.label}</span>
				</button>
			{/if}
		</div>
		<MediaPicker
			bind:open={pickerOpen}
			multiple
			title={field.label}
			kinds={['image']}
			value={ids}
			onselect={(picked, items) => {
				remember(items);
				value = picked.slice(0, field.kind === 'images' ? (field.max ?? 24) : 24);
			}}
		/>
	{:else if field.kind === 'list'}
		{@const items = value as Record<string, unknown>[]}
		<div class="flex flex-col gap-3" role="group" aria-labelledby="{id}-label">
			{#each items as item, i (item)}
				<fieldset class="rounded-card border border-line p-3">
					<legend class="px-1 text-small font-semibold">{field.itemLabel} {i + 1}</legend>
					<div class="flex flex-col gap-3">
						{#each field.fields as sub (sub.key)}
							<Self
								field={sub}
								bind:value={item[sub.key]}
								{media}
								id="{id}-{i}-{sub.key}"
								{disabled}
							/>
						{/each}
					</div>
					{#if !disabled}
						<div class="mt-2 flex justify-end gap-1">
							<button
								type="button"
								class="icon-btn size-8!"
								aria-label="Naikkan {field.itemLabel} {i + 1}"
								disabled={i === 0}
								onclick={() => move(items, i, -1)}><ArrowUp size={14} aria-hidden="true" /></button
							>
							<button
								type="button"
								class="icon-btn size-8!"
								aria-label="Turunkan {field.itemLabel} {i + 1}"
								disabled={i === items.length - 1}
								onclick={() => move(items, i, 1)}><ArrowDown size={14} aria-hidden="true" /></button
							>
							<button
								type="button"
								class="btn btn--ghost btn--sm text-danger"
								onclick={() => items.splice(i, 1)}
							>
								Hapus <span class="sr-only">{field.itemLabel} {i + 1}</span>
							</button>
						</div>
					{/if}
				</fieldset>
			{/each}
			{#if !disabled && items.length < (field.max ?? 12)}
				<button
					type="button"
					class="btn btn--secondary btn--sm w-fit"
					onclick={() => items.push(blankItem())}
				>
					<Plus size={14} aria-hidden="true" /> Tambah {field.itemLabel.toLowerCase()}
				</button>
			{/if}
		</div>
	{/if}

	{#if field.hint}<p class="field__hint">{field.hint}</p>{/if}
</div>
