<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Images from '@lucide/svelte/icons/images';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import PublishBar from '#lib/components/admin/PublishBar.svelte';
	import SortableList from '#lib/components/admin/SortableList.svelte';
	import { EVENT_TYPE_LABEL, type EventType } from '#lib/crm.ts';
	import { postAction, refreshThenToast } from '#lib/enhance.ts';
	import { dateID } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Album = (typeof data.albums)[number];
	let deleteFor = $state<Album | null>(null);
	let deleteOpen = $state(false);

	async function reorder(ids: string[]) {
		const error = await postAction('?/reorder', { ids: ids.join(',') });
		if (error) toast.error(error);
	}
</script>

<div class="page-body">
	<PageHeader
		title="Portofolio"
		description="Album yang tampil di situs. Urutan, sembunyikan, dan album baru tampil setelah Terbitkan."
	>
		{#snippet actions()}
			{#if data.can.create}
				<a
					class="btn btn--secondary"
					href={resolve('/admin/(app)/konten/portofolio/[id]', { id: 'baru' })}
				>
					<Plus size={16} aria-hidden="true" /> Album
				</a>
			{/if}
		{/snippet}
	</PageHeader>

	<PublishBar
		dirty={data.status.dirty}
		publishedAt={data.status.publishedAt}
		canPublish={data.can.update}
	/>

	{#if data.albums.length}
		<SortableList
			items={data.albums}
			label="Urutan album"
			itemName={(a) => a.title}
			onreorder={reorder}
			disabled={!data.can.update}
		>
			{#snippet row(a)}
				{@const cover = a.coverMediaId ? data.media[a.coverMediaId] : undefined}
				<div class="flex flex-wrap items-center gap-3">
					<span class="size-14 shrink-0 overflow-hidden rounded-card bg-sage-20">
						{#if cover?.thumb}
							<img
								src={cover.thumb}
								alt=""
								class="size-full object-cover"
								style:object-position="{cover.focalX * 100}% {cover.focalY * 100}%"
							/>
						{/if}
					</span>
					<div class={['min-w-0 flex-1', !a.visible && 'opacity-60']}>
						<p class="flex flex-wrap items-center gap-2 font-semibold">
							{a.title}
							{#if !a.visible}<span class="chip">Disembunyikan</span>{/if}
						</p>
						<p class="text-small text-ink-2">
							{EVENT_TYPE_LABEL[a.eventType as EventType]}
							{#if a.city}· {a.city}{/if}
							{#if a.eventDate}· {dateID(a.eventDate)}{/if}
							· {a.items} media
						</p>
					</div>
					<div class="flex items-center gap-1">
						{#if data.can.update}
							<form method="post" action="?/visible" use:enhance={refreshThenToast()}>
								<input type="hidden" name="id" value={a.id} />
								<input type="hidden" name="visible" value={a.visible ? 'false' : 'true'} />
								<button
									type="submit"
									class="icon-btn"
									aria-label="{a.visible ? 'Sembunyikan' : 'Tampilkan'} album {a.title}"
								>
									{#if a.visible}<Eye size={16} aria-hidden="true" />{:else}<EyeOff
											size={16}
											aria-hidden="true"
										/>{/if}
								</button>
							</form>
						{/if}
						<a
							class="icon-btn"
							href={resolve('/admin/(app)/konten/portofolio/[id]', { id: a.id })}
							aria-label="Ubah album {a.title}"
						>
							<PencilLine size={16} aria-hidden="true" />
						</a>
						{#if data.can.delete}
							<button
								type="button"
								class="icon-btn text-danger"
								aria-label="Hapus album {a.title}"
								onclick={() => {
									deleteFor = a;
									deleteOpen = true;
								}}
							>
								<Trash2 size={16} aria-hidden="true" />
							</button>
						{/if}
					</div>
				</div>
			{/snippet}
		</SortableList>
	{:else}
		<EmptyState
			icon={Images}
			message="Belum ada album. Buat album pertama dari foto dan video acara."
		/>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus album?"
	action="?/delete"
	fields={{ id: deleteFor?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	Album <strong>{deleteFor?.title}</strong> akan dihapus. Foto dan videonya tetap ada di Media. Jika sudah
	terbit, album tetap tampil di situs sampai Portofolio diterbitkan lagi.
</ConfirmDialog>
