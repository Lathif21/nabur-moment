<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ImageIcon from '@lucide/svelte/icons/image';
	import ImageUp from '@lucide/svelte/icons/image-up';
	import Link2 from '@lucide/svelte/icons/link-2';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import Modal from '#lib/components/admin/Modal.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import FocalPicker from '#lib/components/media/FocalPicker.svelte';
	import MediaGrid from '#lib/components/media/MediaGrid.svelte';
	import MediaUploader from '#lib/components/media/MediaUploader.svelte';
	import CoverImage from '#lib/components/site/CoverImage.svelte';
	import { refreshThenToast } from '#lib/enhance.ts';
	import { embedAspect } from '#lib/media/embed.ts';
	import {
		duration,
		fileSize,
		KIND_LABELS,
		PROVIDER_LABELS,
		type MediaItem
	} from '#lib/media/types.ts';
	import { uploadEmbedCover } from '#lib/media/upload.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The drawer follows the item by id, so it shows fresh data after every reload
	let currentId = $state<string | null>(null);
	const current = $derived(data.items.find((m) => m.id === currentId) ?? null);
	let detailOpen = $state(false);
	let focal = $state({ x: 0.5, y: 0.5 });
	let usage = $state<{ ownerType: string; ownerId: string; field: string }[] | null>(null);
	let embedOpen = $state(false);
	let embedErrors = $state<Record<string, string>>({});
	let deleteOpen = $state(false);
	let busy = $state(false);

	const FILTERS = [
		{ label: 'Semua', href: '' },
		{ label: 'Gambar', href: 'kind=image' },
		{ label: 'Video', href: 'kind=video' },
		{ label: 'Embed', href: 'kind=embed' },
		{ label: 'Belum dipakai', href: 'unused=1' }
	];
	const activeFilter = $derived(
		data.filter.unused ? 'unused=1' : data.filter.kind ? `kind=${data.filter.kind}` : ''
	);

	async function open(m: MediaItem) {
		currentId = m.id;
		focal = { x: m.focalX, y: m.focalY };
		usage = null;
		detailOpen = true;
		const res = await fetch(resolve('/admin/api/media/[id]', { id: m.id }));
		if (res.ok && currentId === m.id) usage = await res.json();
	}

	// Embed cover (Instagram / TikTok give no picture): straight to the bucket, then reload
	let coverInput = $state<HTMLInputElement>();
	let coverBusy = $state(false);
	const coverBase = (id: string) => resolve('/admin/api/media/[id]/cover', { id });

	async function pickCover(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || !current) return;
		coverBusy = true;
		try {
			await uploadEmbedCover(file, coverBase(current.id));
			await invalidateAll();
			toast.success('Sampul disimpan.');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			coverBusy = false;
		}
	}

	async function removeCover() {
		if (!current) return;
		coverBusy = true;
		try {
			const res = await fetch(coverBase(current.id), { method: 'DELETE' });
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? 'Gagal.');
			await invalidateAll();
			toast.success('Sampul dihapus.');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			coverBusy = false;
		}
	}

	const USAGE_LABELS: Record<string, string> = {
		page_section: 'Halaman',
		portfolio_album: 'Portofolio',
		package: 'Paket',
		testimonial: 'Testimoni',
		site_settings: 'Pengaturan situs'
	};
</script>

<div class="page-body">
	<PageHeader
		title="Media"
		description="Foto, video, dan embed untuk situs. Media yang sedang dipakai tidak bisa dihapus."
	>
		{#snippet actions()}
			{#if data.can.create}
				<button
					type="button"
					class="btn btn--secondary"
					onclick={() => {
						embedErrors = {};
						embedOpen = true;
					}}
				>
					<Link2 size={16} aria-hidden="true" /> Tambah embed
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.can.create}
		<MediaUploader onuploaded={() => invalidateAll()} />
	{/if}

	<nav class="flex flex-wrap gap-1.5" aria-label="Saring media">
		{#each FILTERS as f (f.href)}
			<a
				href={f.href ? resolve(`admin/konten/media?${f.href}`) : resolve('admin/konten/media')}
				class={['btn btn--sm', activeFilter === f.href ? 'btn--primary' : 'btn--secondary']}
				aria-current={activeFilter === f.href ? 'page' : undefined}
				data-sveltekit-noscroll>{f.label}</a
			>
		{/each}
	</nav>

	{#if data.items.length}
		<MediaGrid items={data.items} onpick={open} />
	{:else}
		<EmptyState
			icon={ImageIcon}
			message={activeFilter
				? 'Tidak ada media untuk saringan ini.'
				: 'Belum ada media. Unggah foto atau video pertama.'}
		/>
	{/if}
</div>

<Drawer
	bind:open={detailOpen}
	title={current ? KIND_LABELS[current.kind] : 'Media'}
	description={current?.kind === 'embed'
		? PROVIDER_LABELS[current.embedProvider!]
		: (current?.filename ?? undefined)}
>
	{#if current}
		<form
			id="media-detail"
			method="post"
			action="?/update"
			class="flex flex-col gap-5"
			use:enhance={refreshThenToast({
				start: () => (busy = true),
				end: () => (busy = false)
			})}
		>
			<input type="hidden" name="id" value={current.id} />

			{#if current.kind === 'image'}
				{#if data.can.update}
					<FocalPicker src={current.thumb!} bind:x={focal.x} bind:y={focal.y} />
				{:else}
					<img src={current.thumb} alt={current.alt} class="w-full rounded-card" />
				{/if}
			{:else if current.kind === 'video'}
				<video
					src={current.src}
					poster={current.poster ?? undefined}
					controls
					muted
					playsinline
					preload="none"
					class="w-full rounded-card bg-forest"
				></video>
				<input type="hidden" name="focalX" value={current.focalX} />
				<input type="hidden" name="focalY" value={current.focalY} />
			{:else}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external Instagram / TikTok / YouTube URL, validated by parseEmbed -->
				<a
					href={current.embedUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-small break-all text-olive underline underline-offset-2"
					>{current.embedUrl}<span class="sr-only"> (tab baru)</span></a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<input type="hidden" name="focalX" value={current.focalX} />
				<input type="hidden" name="focalY" value={current.focalY} />

				<section aria-labelledby="embed-cover-title" class="flex flex-col gap-2">
					<h3 id="embed-cover-title" class="text-small font-semibold">Sampul</h3>
					{#if current.thumb}
						<div
							class="w-40 overflow-hidden rounded-card bg-sage-20"
							style:aspect-ratio={embedAspect(current.embedProvider)}
						>
							<CoverImage media={current} sizes="10rem" class="h-full w-full object-cover" />
						</div>
					{/if}
					<p class="text-small text-ink-2">
						{#if current.coverUploaded}
							Gambar ini dipakai sebagai sampul album dan di balik tombol putar.
						{:else if current.thumb}
							Memakai thumbnail dari YouTube. Unggah gambar untuk menggantinya.
						{:else}
							{PROVIDER_LABELS[current.embedProvider!]} tidak memberi gambar. Unggah satu agar embed ini
							bisa jadi sampul album.
						{/if}
					</p>
					{#if data.can.update}
						<input
							bind:this={coverInput}
							type="file"
							accept="image/jpeg,image/png,image/webp,image/heic,image/avif"
							class="sr-only"
							tabindex="-1"
							aria-hidden="true"
							onchange={pickCover}
						/>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="btn btn--secondary btn--sm"
								disabled={coverBusy}
								onclick={() => coverInput?.click()}
							>
								<ImageUp size={16} aria-hidden="true" />
								{coverBusy
									? 'Mengunggah…'
									: current.coverUploaded
										? 'Ganti sampul'
										: 'Unggah sampul'}
							</button>
							{#if current.coverUploaded}
								<button
									type="button"
									class="btn btn--ghost btn--sm text-danger"
									disabled={coverBusy}
									onclick={removeCover}
								>
									<X size={16} aria-hidden="true" /> Hapus sampul
								</button>
							{/if}
						</div>
					{/if}
				</section>
			{/if}

			{#if current.kind !== 'embed'}
				<dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-small">
					<dt class="text-ink-2">Ukuran</dt>
					<dd class="tabular-nums">{current.width} × {current.height} px</dd>
					<dt class="text-ink-2">File</dt>
					<dd class="tabular-nums">{fileSize(current.bytes)}</dd>
					{#if current.kind === 'video'}
						<dt class="text-ink-2">Durasi</dt>
						<dd class="tabular-nums">{duration(current.durationS)}</dd>
					{/if}
				</dl>
			{/if}

			<Field
				label="Teks alternatif (alt)"
				name="alt"
				hint={current.kind === 'image'
					? 'Wajib sebelum dipakai di halaman. Jelaskan isi foto, misal "Pengantin saling menggenggam tangan saat akad".'
					: 'Opsional, untuk pembaca layar.'}
			>
				{#snippet children(attrs)}
					{#key current?.id}
						<textarea
							{...attrs}
							class="input min-h-20"
							maxlength="300"
							readonly={!data.can.update}
							defaultValue={current?.alt ?? ''}></textarea>
					{/key}
				{/snippet}
			</Field>

			<section aria-label="Dipakai di" class="flex flex-col gap-1.5">
				<h3 class="text-small font-semibold">Dipakai di</h3>
				{#if usage === null}
					<p class="text-small text-ink-2">Memuat…</p>
				{:else if usage.length}
					<ul class="flex flex-col gap-1 text-small">
						{#each usage as u (u.ownerType + u.ownerId + u.field)}
							<li>{USAGE_LABELS[u.ownerType] ?? u.ownerType} · {u.ownerId} · {u.field}</li>
						{/each}
					</ul>
				{:else}
					<p class="text-small text-ink-2">Belum dipakai di mana pun.</p>
				{/if}
			</section>
		</form>
	{/if}

	{#snippet footer()}
		{#if data.can.delete}
			<button
				type="button"
				class="btn btn--ghost mr-auto text-danger"
				disabled={!current || current.usage > 0}
				title={current && current.usage > 0 ? 'Masih dipakai, tidak bisa dihapus' : undefined}
				onclick={() => (deleteOpen = true)}
			>
				<Trash2 size={16} aria-hidden="true" /> Hapus
			</button>
		{/if}
		<button type="button" class="btn btn--secondary" onclick={() => (detailOpen = false)}
			>Tutup</button
		>
		{#if data.can.update}
			<button type="submit" form="media-detail" class="btn btn--primary" disabled={busy}>
				{busy ? 'Menyimpan…' : 'Simpan'}
			</button>
		{/if}
	{/snippet}
</Drawer>

<Modal bind:open={embedOpen} title="Tambah embed" description="Instagram, TikTok, atau YouTube.">
	<form
		id="add-embed"
		method="post"
		action="?/embed"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					embedErrors = (result.data?.fields ?? {}) as Record<string, string>;
					return;
				}
				await update({ navigate: false });
				embedOpen = false;
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		}}
	>
		<Field
			label="Tautan"
			name="url"
			required
			hint="Contoh: https://www.instagram.com/reel/…"
			errors={embedErrors.url ? [embedErrors.url] : undefined}
		>
			{#snippet children(attrs)}
				<input {...attrs} class="input" type="url" inputmode="url" autocomplete="off" />
			{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (embedOpen = false)}
			>Batal</button
		>
		<button type="submit" form="add-embed" class="btn btn--primary" disabled={busy}>Tambah</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus media?"
	action="?/delete"
	fields={{ id: current?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
	onsuccess={() => {
		detailOpen = false;
		currentId = null;
	}}
>
	File akan dihapus dari penyimpanan dan tidak bisa dikembalikan.
</ConfirmDialog>
