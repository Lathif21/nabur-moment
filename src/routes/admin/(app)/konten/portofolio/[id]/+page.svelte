<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Play from '@lucide/svelte/icons/play';
	import Star from '@lucide/svelte/icons/star';
	import X from '@lucide/svelte/icons/x';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import SortableList from '#lib/components/admin/SortableList.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import MediaPicker from '#lib/components/media/MediaPicker.svelte';
	import { EVENT_TYPES } from '#lib/crm.ts';
	import { albumCoverId, pictureOf } from '#lib/media/cover.ts';
	import { PROVIDER_LABELS, type MediaItem } from '#lib/media/types.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The editor owns the album from here on (saved with the form)
	// svelte-ignore state_referenced_locally
	let media = $state<Record<string, MediaItem>>({ ...data.media });
	// svelte-ignore state_referenced_locally
	let items = $state((data.album?.items ?? []).map((i) => ({ id: i.mediaId, caption: i.caption })));
	// svelte-ignore state_referenced_locally
	let cover = $state<string | null>(data.album?.coverMediaId ?? null);
	let pickerOpen = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	// Same rule as the site (albumCoverId): the chosen cover, else the first item with a picture
	const coverId = $derived(
		albumCoverId({ cover, items: items.map((i) => ({ media: i.id })) }, media)
	);
	const payload = $derived(
		JSON.stringify(items.map((i) => ({ mediaId: i.id, caption: i.caption })))
	);
	const err = (k: string) => (errors[k] ? [errors[k]] : undefined);

	function add(picked: MediaItem[]) {
		for (const m of picked) {
			media[m.id] = m;
			if (!items.some((i) => i.id === m.id)) items.push({ id: m.id, caption: '' });
		}
	}

	function remove(id: string) {
		items = items.filter((i) => i.id !== id);
		if (cover === id) cover = null;
	}

	function reorder(ids: string[]) {
		const byId = new Map(items.map((i) => [i.id, i]));
		items = ids.map((id) => byId.get(id)!);
	}

	function label(m: MediaItem | undefined) {
		if (!m) return 'Media';
		if (m.kind === 'embed') return `${PROVIDER_LABELS[m.embedProvider!]} embed`;
		return m.alt || m.filename || (m.kind === 'video' ? 'Video' : 'Foto');
	}
</script>

<div class="page-body">
	<a
		href={resolve('admin/konten/portofolio')}
		class="inline-flex min-h-10 w-fit items-center gap-1.5 text-small font-semibold text-olive underline-offset-4 hover:underline"
	>
		<ArrowLeft size={15} aria-hidden="true" /> Semua album
	</a>

	<PageHeader
		title={data.album ? data.album.title : 'Album baru'}
		description="Perubahan tampil di situs setelah Terbitkan di daftar Portofolio."
	/>

	<form
		method="post"
		action="?/save"
		class="flex flex-col gap-5"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					errors = (result.data?.fields ?? {}) as Record<string, string>;
					toast.error(
						String(result.data?.error ?? Object.values(errors)[0] ?? 'Periksa isian album.')
					);
					return;
				}
				errors = {};
				await update({ reset: false });
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		}}
	>
		<section class="card grid gap-4 p-5 md:grid-cols-2" aria-label="Detail album">
			<Field label="Judul" name="title" required hint="Contoh: Nadia & Raka" errors={err('title')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="80" defaultValue={data.album?.title ?? ''} />
				{/snippet}
			</Field>
			<Field
				label="Alamat (slug)"
				name="slug"
				hint="Kosong = dibuat dari judul. Contoh: nadia-raka"
				errors={err('slug')}
			>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="60" defaultValue={data.album?.slug ?? ''} />
				{/snippet}
			</Field>
			<Field label="Jenis acara" name="eventType" required errors={err('eventType')}>
				{#snippet children(attrs)}
					<select {...attrs} class="input" defaultValue={data.album?.eventType ?? 'wedding'}>
						{#each EVENT_TYPES as e (e.key)}<option value={e.key}>{e.label}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Tanggal acara" name="eventDate" errors={err('eventDate')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" type="date" defaultValue={data.album?.eventDate ?? ''} />
				{/snippet}
			</Field>
			<Field label="Venue" name="venue">
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="120" defaultValue={data.album?.venue ?? ''} />
				{/snippet}
			</Field>
			<Field label="Kota" name="city">
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="60" defaultValue={data.album?.city ?? ''} />
				{/snippet}
			</Field>
			<div class="md:col-span-2">
				<Field label="Cerita singkat" name="story" hint="Baris kosong memisahkan paragraf.">
					{#snippet children(attrs)}
						<textarea
							{...attrs}
							class="input min-h-28"
							maxlength="2000"
							defaultValue={data.album?.story ?? ''}></textarea>
					{/snippet}
				</Field>
			</div>
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="visible"
					checked={data.album ? data.album.visible : true}
				/>
				Tampilkan di situs
			</label>
		</section>

		<section class="card flex flex-col gap-4 p-5" aria-labelledby="album-media">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h2 id="album-media" class="font-display text-section-title">
					Media <span class="text-small font-normal text-ink-2">({items.length})</span>
				</h2>
				<button
					type="button"
					class="btn btn--secondary btn--sm"
					onclick={() => (pickerOpen = true)}
				>
					<ImagePlus size={14} aria-hidden="true" /> Tambah media
				</button>
			</div>
			<input type="hidden" name="items" value={payload} />
			<input type="hidden" name="coverMediaId" value={cover ?? ''} />

			{#if items.length}
				<SortableList
					{items}
					label="Urutan media album"
					itemName={(i) => label(media[i.id])}
					onreorder={reorder}
				>
					{#snippet row(item, i)}
						{@const m = media[item.id]}
						<div class="flex flex-wrap items-center gap-3">
							<span class="relative size-16 shrink-0 overflow-hidden rounded-card bg-sage-20">
								{#if m?.thumb}
									<img
										src={m.thumb}
										alt=""
										class="size-full object-cover"
										style:object-position="{m.focalX * 100}% {m.focalY * 100}%"
									/>
								{:else}
									<span class="flex size-full items-center justify-center text-ink-2"
										><Link2 size={18} aria-hidden="true" /></span
									>
								{/if}
								{#if m?.kind === 'video'}
									<span class="absolute bottom-1 left-1 rounded-chip bg-forest/80 p-0.5 text-cream"
										><Play size={10} aria-hidden="true" /></span
									>
								{/if}
							</span>
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<span class="flex flex-wrap items-center gap-2 text-small font-semibold">
									{label(m)}
									{#if coverId === item.id}<span class="chip chip--success">Sampul</span>{/if}
									{#if m?.kind === 'image' && !m.alt}<span class="chip chip--warning"
											>Tanpa alt</span
										>{/if}
								</span>
								<input
									class="input min-h-9! py-1!"
									maxlength="200"
									placeholder="Keterangan (opsional)"
									aria-label="Keterangan media {i + 1}"
									bind:value={item.caption}
								/>
							</div>
							<div class="flex items-center gap-1">
								{#if pictureOf(m) && coverId !== item.id}
									<button
										type="button"
										class="icon-btn"
										aria-label="Jadikan sampul: {label(m)}"
										title="Jadikan sampul"
										onclick={() => (cover = item.id)}><Star size={16} aria-hidden="true" /></button
									>
								{/if}
								<button
									type="button"
									class="icon-btn text-danger"
									aria-label="Lepas dari album: {label(m)}"
									onclick={() => remove(item.id)}><X size={16} aria-hidden="true" /></button
								>
							</div>
						</div>
					{/snippet}
				</SortableList>
			{:else}
				<p class="text-small text-ink-2">
					Belum ada media. Tambahkan foto, video vertikal, atau embed Instagram / TikTok / YouTube.
				</p>
			{/if}
		</section>

		{#if data.canEdit}
			<div class="flex justify-end">
				<button type="submit" class="btn btn--primary" disabled={busy}>
					{busy ? 'Menyimpan…' : 'Simpan album'}
				</button>
			</div>
		{/if}
	</form>
</div>

<MediaPicker
	bind:open={pickerOpen}
	multiple
	title="Tambah media ke album"
	value={[]}
	onselect={(_, picked) => add(picked)}
/>
