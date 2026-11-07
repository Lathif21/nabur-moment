<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
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
	import { postAction, refreshThenToast } from '#lib/enhance.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Item = (typeof data.items)[number];

	let editing = $state<Item | null>(null);
	let drawerOpen = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	let deleteFor = $state<Item | null>(null);
	let deleteOpen = $state(false);

	function edit(item: Item | null) {
		editing = item;
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
		title="FAQ"
		description="Pertanyaan yang sering ditanyakan. Perubahan tampil di situs setelah Terbitkan."
	>
		{#snippet actions()}
			{#if data.can.create}
				<button type="button" class="btn btn--secondary" onclick={() => edit(null)}>
					<Plus size={16} aria-hidden="true" /> Pertanyaan
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
			label="Urutan FAQ"
			itemName={(i) => i.question}
			onreorder={reorder}
			disabled={!data.can.update}
		>
			{#snippet row(item)}
				<div class="flex flex-wrap items-start justify-between gap-2">
					<div class={['min-w-0 flex-1', !item.visible && 'opacity-60']}>
						<p class="font-semibold">{item.question}</p>
						<p class="line-clamp-2 text-small text-ink-2">{item.answer}</p>
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
									aria-label="{item.visible ? 'Sembunyikan' : 'Tampilkan'} {item.question}"
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
								aria-label="Ubah {item.question}"
								onclick={() => edit(item)}
							>
								<PencilLine size={16} aria-hidden="true" />
							</button>
						{/if}
						{#if data.can.delete}
							<button
								type="button"
								class="icon-btn text-danger"
								aria-label="Hapus {item.question}"
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
		<EmptyState
			icon={CircleHelp}
			message="Belum ada pertanyaan. Tambahkan yang paling sering ditanyakan klien."
		/>
	{/if}
</div>

<Drawer
	bind:open={drawerOpen}
	title={editing ? 'Ubah pertanyaan' : 'Pertanyaan baru'}
	description="Tampil di situs setelah Terbitkan."
>
	<form
		id="faq-form"
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
				label="Pertanyaan"
				name="question"
				required
				errors={errors.question ? [errors.question] : undefined}
			>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="200" defaultValue={editing?.question ?? ''} />
				{/snippet}
			</Field>
			<Field
				label="Jawaban"
				name="answer"
				required
				hint="Baris kosong memisahkan paragraf."
				errors={errors.answer ? [errors.answer] : undefined}
			>
				{#snippet children(attrs)}
					<textarea
						{...attrs}
						class="input min-h-40"
						maxlength="3000"
						defaultValue={editing?.answer ?? ''}></textarea>
				{/snippet}
			</Field>
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
		<button type="submit" form="faq-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus pertanyaan?"
	action="?/delete"
	fields={{ id: deleteFor?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	<strong>{deleteFor?.question}</strong> akan dihapus. Jika sudah terbit, pertanyaan ini tetap tampil
	di situs sampai FAQ diterbitkan lagi.
</ConfirmDialog>
