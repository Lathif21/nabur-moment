<script lang="ts">
	import { resolve } from '$app/paths';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-arrow-up';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Search from '@lucide/svelte/icons/search';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Users from '@lucide/svelte/icons/users';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import ClientDrawer, { type ClientValues } from '#lib/components/crm/ClientDrawer.svelte';
	import { waLink } from '#lib/crm.ts';
	import { phoneDisplay } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let drawerOpen = $state(false);
	let editing = $state<ClientValues | null>(null);
	let archiveFor = $state<{ id: string; name: string; archived: boolean } | null>(null);
	let archiveOpen = $state(false);

	const filtered = $derived(!!(data.filter.q || data.filter.sourceId));
	const listHref = (archived: boolean) =>
		archived ? `${resolve('admin/klien')}?arsip=1` : resolve('admin/klien');

	function openNew() {
		editing = null;
		drawerOpen = true;
	}
</script>

<div class="page-body">
	<PageHeader
		title="Klien"
		description="Orang yang memesan. Cari berdasarkan nama, WhatsApp, email atau Instagram."
	>
		{#snippet actions()}
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={openNew}>
					<UserPlus size={16} aria-hidden="true" /> Tambah klien
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<form
		method="get"
		action={resolve('admin/klien')}
		class="flex flex-wrap items-end gap-3"
		role="search"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
	>
		{#if data.filter.archived}<input type="hidden" name="arsip" value="1" />{/if}
		<label class="field min-w-56 flex-1">
			<span>Cari klien</span>
			<span class="relative block">
				<Search
					size={16}
					class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2"
					aria-hidden="true"
				/>
				<input
					type="search"
					name="q"
					class="input pl-9"
					placeholder="Nama, 0812…, email, @instagram"
					defaultValue={data.filter.q}
					autocomplete="off"
				/>
			</span>
		</label>
		<label class="field w-full sm:w-52">
			<span>Sumber</span>
			<select
				name="sumber"
				class="input"
				value={data.filter.sourceId ?? ''}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="">Semua sumber</option>
				{#each data.sources as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
			</select>
		</label>
		<button type="submit" class="btn btn--secondary">Cari</button>
	</form>

	<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() + query string, built in listHref -->
	<nav class="flex gap-1" aria-label="Status klien">
		<a
			class="btn btn--sm {data.filter.archived ? 'btn--ghost' : 'btn--secondary'}"
			href={listHref(false)}
			aria-current={data.filter.archived ? undefined : 'page'}>Aktif</a
		>
		<a
			class="btn btn--sm {data.filter.archived ? 'btn--secondary' : 'btn--ghost'}"
			href={listHref(true)}
			aria-current={data.filter.archived ? 'page' : undefined}>Arsip</a
		>
	</nav>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if data.clients.length === 0}
		<EmptyState
			icon={Users}
			message={filtered
				? 'Tidak ada klien yang cocok dengan pencarian ini.'
				: data.filter.archived
					? 'Belum ada klien yang diarsipkan.'
					: 'Belum ada klien. Tambahkan klien pertama atau tunggu inquiry dari website.'}
		>
			{#snippet action()}
				{#if !filtered && !data.filter.archived && data.allow.create}
					<button type="button" class="btn btn--primary" onclick={openNew}>Tambah klien</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<section class="card table-wrap" aria-label="Daftar klien">
			<table class="table min-w-[48rem]">
				<thead>
					<tr>
						<th scope="col">Nama</th>
						<th scope="col">WhatsApp</th>
						<th scope="col">Sumber</th>
						<th scope="col">Kota</th>
						<th scope="col" class="text-right">Booking</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.clients as c (c.id)}
						<tr>
							<td>
								<a
									class="font-semibold underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/klien/[id]', { id: c.id })}>{c.name}</a
								>
								{#if c.instagram}<span class="block text-small text-ink-2">@{c.instagram}</span
									>{/if}
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
							<td
								>{#if c.sourceName}<span class="chip">{c.sourceName}</span>{:else}–{/if}</td
							>
							<td>{c.city ?? '–'}</td>
							<td class="text-right tabular-nums">{c.bookings}</td>
							<td>
								<span class="flex justify-end gap-1">
									{#if data.allow.update}
										<button
											type="button"
											class="icon-btn"
											aria-label="Ubah {c.name}"
											onclick={() => {
												editing = c;
												drawerOpen = true;
											}}
										>
											<Pencil size={16} aria-hidden="true" />
										</button>
									{/if}
									{#if c.archivedAt ? data.allow.update : data.allow.delete}
										<button
											type="button"
											class="icon-btn"
											aria-label="{c.archivedAt ? 'Kembalikan' : 'Arsipkan'} {c.name}"
											onclick={() => {
												archiveFor = { id: c.id, name: c.name, archived: !!c.archivedAt };
												archiveOpen = true;
											}}
										>
											{#if c.archivedAt}<ArchiveRestore
													size={16}
													aria-hidden="true"
												/>{:else}<Archive size={16} aria-hidden="true" />{/if}
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

<ClientDrawer
	bind:open={drawerOpen}
	client={editing}
	sources={data.sources}
	action={editing ? '?/update' : '?/create'}
/>

<ConfirmDialog
	bind:open={archiveOpen}
	title={archiveFor?.archived ? 'Kembalikan klien?' : 'Arsipkan klien?'}
	action="?/archive"
	fields={{ id: archiveFor?.id ?? '', archived: archiveFor?.archived ? 'false' : 'true' }}
	confirmLabel={archiveFor?.archived ? 'Kembalikan' : 'Arsipkan'}
>
	{#if archiveFor?.archived}
		<strong>{archiveFor?.name}</strong> muncul lagi di daftar klien aktif.
	{:else}
		<strong>{archiveFor?.name}</strong> disembunyikan dari daftar. Booking dan riwayatnya tetap tersimpan.
	{/if}
</ConfirmDialog>
