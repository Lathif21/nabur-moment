<script lang="ts">
	import { enhance } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import MessageSquareQuote from '@lucide/svelte/icons/message-square-quote';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import PublishBar from '#lib/components/admin/PublishBar.svelte';
	import SortableList from '#lib/components/admin/SortableList.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import ImagePickField from '#lib/components/form/ImagePickField.svelte';
	import { postAction, refreshThenToast } from '#lib/enhance.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Item = (typeof data.items)[number];

	// svelte-ignore state_referenced_locally
	let media = $state<Record<string, MediaItem>>({ ...data.media });
	let editing = $state<Item | null>(null);
	let photo = $state<string | null>(null);
	let drawerOpen = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	let deleteFor = $state<Item | null>(null);
	let deleteOpen = $state(false);

	function edit(item: Item | null) {
		editing = item;
		photo = item?.photoMediaId ?? null;
		errors = {};
		drawerOpen = true;
	}

	async function reorder(ids: string[]) {
		const error = await postAction('?/reorder', { ids: ids.join(',') });
		if (error) toast.error(error);
	}
</script>

<div class="page-body">
	<PageHeader
		title="Testimoni"
		description="Kata klien tentang Nabur Moment. Perubahan tampil di situs setelah Terbitkan."
	>
		{#snippet actions()}
			{#if data.can.create}
				<button type="button" class="btn btn--secondary" onclick={() => edit(null)}>
					<Plus size={16} aria-hidden="true" /> Testimoni
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<PublishBar
		dirty={data.status.dirty}
		publishedAt={data.status.publishedAt}
		canPublish={data.can.update}
	/>

	{#if data.items.length}
		<SortableList
			items={data.items}
			label="Urutan testimoni"
			itemName={(i) => i.name}
			onreorder={reorder}
			disabled={!data.can.update}
		>
			{#snippet row(item)}
				{@const pic = item.photoMediaId ? media[item.photoMediaId] : undefined}
				<div class="flex flex-wrap items-start gap-3">
					{#if pic?.thumb}
						<img src={pic.thumb} alt="" class="size-12 shrink-0 rounded-full object-cover" />
					{/if}
					<div class={['min-w-0 flex-1', !item.visible && 'opacity-60']}>
						<p class="font-semibold">
							{item.name}
							{#if item.eventLabel}<span class="font-normal text-ink-2">
									· {item.eventLabel}</span
								>{/if}
						</p>
						<p class="line-clamp-2 text-small text-ink-2">“{item.quote}”</p>
					</div>
					<div class="flex items-center gap-1">
						{#if !item.visible}<span class="chip">Disembunyikan</span>{/if}
						{#if data.can.update}
							<form method="post" action="?/visible" use:enhance={refreshThenToast()}>
								<input type="hidden" name="id" value={item.id} />
								<input type="hidden" name="visible" value={item.visible ? 'false' : 'true'} />
								<button
									type="submit"
									class="icon-btn"
									aria-label="{item.visible ? 'Sembunyikan' : 'Tampilkan'} testimoni {item.name}"
								>
									{#if item.visible}<Eye size={16} aria-hidden="true" />{:else}<EyeOff
											size={16}
											aria-hidden="true"
										/>{/if}
								</button>
							</form>
							<button
								type="button"
								class="icon-btn"
								aria-label="Ubah testimoni {item.name}"
								onclick={() => edit(item)}
							>
								<PencilLine size={16} aria-hidden="true" />
							</button>
						{/if}
						{#if data.can.delete}
							<button
								type="button"
								class="icon-btn text-danger"
								aria-label="Hapus testimoni {item.name}"
								onclick={() => {
									deleteFor = item;
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
		<EmptyState icon={MessageSquareQuote} message="Belum ada testimoni." />
	{/if}
</div>

<Drawer
	bind:open={drawerOpen}
	title={editing ? 'Ubah testimoni' : 'Testimoni baru'}
	description="Tampil di situs setelah Terbitkan."
>
	<form
		id="testimonial-form"
		method="post"
		action="?/save"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					errors = (result.data?.fields ?? {}) as Record<string, string>;
					if (result.data?.error) toast.error(String(result.data.error));
					return;
				}
				await update({ navigate: false });
				drawerOpen = false;
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		}}
	>
		{#key editing?.id}
			<input type="hidden" name="id" value={editing?.id ?? ''} />
			<Field
				label="Nama"
				name="name"
				required
				hint="Contoh: “Nadia & Raka”"
				errors={errors.name ? [errors.name] : undefined}
			>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="80" defaultValue={editing?.name ?? ''} />
				{/snippet}
			</Field>
			<Field label="Acara" name="eventLabel" hint="Contoh: “Akad · Bandung, 2026”">
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="80" defaultValue={editing?.eventLabel ?? ''} />
				{/snippet}
			</Field>
			<Field
				label="Testimoni"
				name="quote"
				required
				errors={errors.quote ? [errors.quote] : undefined}
			>
				{#snippet children(attrs)}
					<textarea
						{...attrs}
						class="input min-h-32"
						maxlength="1000"
						defaultValue={editing?.quote ?? ''}></textarea>
				{/snippet}
			</Field>
			<ImagePickField name="photoMediaId" label="Foto" bind:value={photo} {media} />
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="visible"
					checked={editing ? editing.visible : true}
				/>
				Tampilkan di situs
			</label>
		{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (drawerOpen = false)}
			>Batal</button
		>
		<button type="submit" form="testimonial-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus testimoni?"
	action="?/delete"
	fields={{ id: deleteFor?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	Testimoni dari <strong>{deleteFor?.name}</strong> akan dihapus. Jika sudah terbit, testimoni ini tetap
	tampil di situs sampai daftar diterbitkan lagi.
</ConfirmDialog>
