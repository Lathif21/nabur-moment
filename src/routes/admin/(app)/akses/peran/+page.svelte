<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let createOpen = $state(false);
	let createErrors = $state<Record<string, string>>({});
	let busy = $state(false);
	let deleteFor = $state<{ id: string; name: string } | null>(null);
	let deleteOpen = $state(false);

	function openCreate() {
		createErrors = {};
		createOpen = true;
	}
</script>

<div class="page-body">
	<PageHeader
		title="Peran"
		description="Peran menentukan menu dan tindakan yang boleh dipakai pengguna. Pemilik selalu punya akses penuh."
	>
		{#snippet actions()}
			<button type="button" class="btn btn--primary" onclick={openCreate}>
				<Plus size={16} aria-hidden="true" /> Peran baru
			</button>
		{/snippet}
	</PageHeader>

	{#if data.roles.length}
		<section class="card table-wrap" aria-label="Daftar peran">
			<table class="table min-w-[36rem]">
				<thead>
					<tr>
						<th scope="col">Nama</th>
						<th scope="col">Pengguna</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.roles as r (r.id)}
						<tr>
							<td>
								<a
									class="font-semibold underline-offset-4 hover:underline"
									href={resolve('/admin/(app)/akses/peran/[id]', { id: r.id })}>{r.name}</a
								>
								{#if r.description}<span class="block text-small text-ink-2">{r.description}</span
									>{/if}
							</td>
							<td class="tabular-nums">{r.users}</td>
							<td>
								<span class="flex justify-end gap-1.5">
									<a
										class="btn btn--secondary btn--sm"
										href={resolve('/admin/(app)/akses/peran/[id]', { id: r.id })}
									>
										<ShieldCheck size={14} aria-hidden="true" /> Atur akses
									</a>
									<button
										type="button"
										class="btn btn--ghost btn--sm"
										aria-label="Hapus peran {r.name}"
										onclick={() => {
											deleteFor = { id: r.id, name: r.name };
											deleteOpen = true;
										}}
									>
										<Trash2 size={14} aria-hidden="true" />
									</button>
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{:else}
		<EmptyState icon={ShieldCheck} message="Belum ada peran. Buat peran pertama, misalnya Admin.">
			{#snippet action()}
				<button type="button" class="btn btn--primary" onclick={openCreate}>Peran baru</button>
			{/snippet}
		</EmptyState>
	{/if}
</div>

<Drawer
	bind:open={createOpen}
	title="Peran baru"
	description="Setelah dibuat, atur menu yang boleh dibuka."
>
	<form
		id="create-role"
		method="post"
		action="?/create"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					createErrors = (result.data?.fields ?? {}) as Record<string, string>;
					return;
				}
				createOpen = false;
				await update();
			};
		}}
	>
		<Field
			label="Nama peran"
			name="name"
			required
			errors={createErrors.name ? [createErrors.name] : undefined}
		>
			{#snippet children(attrs)}
				<input
					{...attrs}
					class="input"
					maxlength="60"
					autocomplete="off"
					placeholder="Admin Keuangan"
				/>
			{/snippet}
		</Field>
		<Field label="Keterangan" name="description" hint="Opsional">
			{#snippet children(attrs)}
				<input {...attrs} class="input" maxlength="200" autocomplete="off" />
			{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (createOpen = false)}
			>Batal</button
		>
		<button type="submit" form="create-role" class="btn btn--primary" disabled={busy}>
			{busy ? 'Membuat…' : 'Buat peran'}
		</button>
	{/snippet}
</Drawer>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus peran?"
	action="?/delete"
	fields={{ id: deleteFor?.id ?? '' }}
	confirmLabel="Hapus peran"
	tone="danger"
>
	Peran <strong>{deleteFor?.name}</strong> akan dihapus. Peran yang masih dipakai pengguna tidak bisa
	dihapus.
</ConfirmDialog>
