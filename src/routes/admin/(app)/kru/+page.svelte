<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Camera from '@lucide/svelte/icons/camera';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import Modal from '#lib/components/admin/Modal.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import PeriodFilter from '#lib/components/admin/PeriodFilter.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import { waLink } from '#lib/crm.ts';
	import { phoneDisplay } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.crew)[number];
	let formOpen = $state(false);
	let editing = $state<Row | null>(null);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	let deleteFor = $state<Row | null>(null);
	let deleteOpen = $state(false);

	const err = (k: string) => (errors[k] ? [errors[k]] : undefined);
	const base = resolve('admin/kru');
	// Keep the chosen period when opening a crew member's page
	const detailHref = (id: string) =>
		`${resolve('/admin/(app)/kru/[id]', { id })}${page.url.search}` as `/${string}`;

	function openForm(row: Row | null) {
		editing = row;
		errors = {};
		formOpen = true;
	}
</script>

<div class="page-body">
	<PageHeader
		title="Kru"
		description="Fotografer dan videografer yang bertugas. Jumlah booking dihitung dari tahap Booked (DP lunas), tanpa Batal, menurut Hari H."
	>
		{#snippet actions()}
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={() => openForm(null)}>
					<Plus size={16} aria-hidden="true" /> Tambah kru
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<PeriodFilter value={data.period} {base} />

	{#if data.crew.length === 0}
		<EmptyState icon={Camera} message="Belum ada kru. Tambahkan kru agar bisa dipilih di booking.">
			{#snippet action()}
				{#if data.allow.create}
					<button type="button" class="btn btn--primary" onclick={() => openForm(null)}
						>Tambah kru</button
					>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<section class="card table-wrap" aria-label="Daftar kru">
			<table class="table min-w-[40rem]">
				<thead>
					<tr>
						<th scope="col">Nama</th>
						<th scope="col">WhatsApp</th>
						<th scope="col" class="text-right">Booking ({data.period.label})</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.crew as c (c.id)}
						<tr class={!c.active ? 'opacity-70' : undefined}>
							<td>
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() + the current query, built in detailHref -->
								<a class="font-semibold underline-offset-2 hover:underline" href={detailHref(c.id)}
									>{c.name}</a
								>
								{#if !c.active}<span class="chip ml-1">Nonaktif</span>{/if}
								{#if c.role}<span class="block text-small text-ink-2">{c.role}</span>{/if}
							</td>
							<td>
								{#if c.phone}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- external wa.me chat link -->
									<a
										class="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
										href={waLink(c.phone)}
										target="_blank"
										rel="noopener noreferrer"
									>
										<MessageCircle size={14} aria-hidden="true" />
										{phoneDisplay(c.phone)}
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{:else}<span class="text-ink-2">–</span>{/if}
							</td>
							<td class="text-right tabular-nums">{c.bookings}</td>
							<td>
								<span class="flex justify-end gap-1">
									{#if data.allow.update}
										<button
											type="button"
											class="icon-btn"
											aria-label="Ubah {c.name}"
											onclick={() => openForm(c)}
										>
											<Pencil size={16} aria-hidden="true" />
										</button>
									{/if}
									{#if data.allow.delete}
										<button
											type="button"
											class="icon-btn"
											aria-label="Hapus {c.name}"
											disabled={c.assigned > 0}
											title={c.assigned > 0
												? 'Sudah tercatat di booking. Nonaktifkan saja.'
												: undefined}
											onclick={() => {
												deleteFor = c;
												deleteOpen = true;
											}}
										>
											<Trash2 size={16} aria-hidden="true" />
										</button>
									{/if}
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

<Modal
	bind:open={formOpen}
	title={editing ? 'Ubah kru' : 'Tambah kru'}
	description="Kru tidak punya akun login."
>
	<form
		id="crew-form"
		method="post"
		action="?/save"
		novalidate
		class="flex flex-col gap-4"
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
				formOpen = false;
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		}}
	>
		{#key editing?.id ?? 'new'}
			<input type="hidden" name="id" value={editing?.id ?? ''} />
			<Field label="Nama" name="name" required errors={err('name')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="120" defaultValue={editing?.name ?? ''} />
				{/snippet}
			</Field>
			<Field label="Peran" name="role" hint="Misal Fotografer, Videografer" errors={err('role')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="60" defaultValue={editing?.role ?? ''} />
				{/snippet}
			</Field>
			<Field label="WhatsApp" name="phone" errors={err('phone')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						type="tel"
						inputmode="tel"
						maxlength="30"
						defaultValue={editing?.phone ? phoneDisplay(editing.phone) : ''}
					/>
				{/snippet}
			</Field>
			<label class="flex min-h-10 items-center gap-3">
				<input type="checkbox" class="checkbox" name="active" checked={editing?.active ?? true} />
				Aktif (bisa dipilih di booking)
			</label>
		{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (formOpen = false)}
			>Batal</button
		>
		<button type="submit" form="crew-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus kru?"
	action="?/delete"
	fields={{ id: deleteFor?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	{deleteFor?.name} akan dihapus dari daftar kru.
</ConfirmDialog>
