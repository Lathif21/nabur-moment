<script lang="ts">
	import { resolve } from '$app/paths';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import ExpenseDrawer from '#lib/components/finance/ExpenseDrawer.svelte';
	import { PAYMENT_METHOD_LABEL } from '#lib/finance.ts';
	import { dateID, rupiah } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.rows)[number];

	let drawerOpen = $state(false);
	let editing = $state<Row | null>(null);
	function openForm(row: Row | null) {
		editing = row;
		drawerOpen = true;
	}

	let deleting = $state<Row | null>(null);
	let deleteOpen = $state(false);

	const submitOnChange = (e: Event & { currentTarget: HTMLSelectElement | HTMLInputElement }) =>
		e.currentTarget.form?.requestSubmit();
</script>

<div class="page-body">
	<PageHeader
		title="Pengeluaran"
		description="{data.rows.length} pengeluaran · {rupiah(data.total)}{data.filter.month
			? ''
			: ' (semua waktu)'}"
	>
		{#snippet actions()}
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={() => openForm(null)}>
					<Plus size={16} aria-hidden="true" /> Catat pengeluaran
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<form method="get" class="flex flex-wrap items-end gap-3" data-sveltekit-keepfocus>
		<div class="field min-w-56 flex-1">
			<label for="exp-q">Cari</label>
			<input
				id="exp-q"
				name="q"
				type="search"
				class="input"
				placeholder="Keterangan, booking, klien, atau kategori"
				defaultValue={data.filter.q}
			/>
		</div>
		<div class="field">
			<label for="exp-month">Bulan</label>
			<input
				id="exp-month"
				name="bulan"
				type="month"
				class="input"
				defaultValue={data.filter.month ?? ''}
				onchange={submitOnChange}
			/>
		</div>
		<div class="field">
			<label for="exp-cat">Kategori</label>
			<select
				id="exp-cat"
				name="kategori"
				class="input"
				value={data.filter.categoryId ?? ''}
				onchange={submitOnChange}
			>
				<option value="">Semua kategori</option>
				{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
		</div>
		<div class="field">
			<label for="exp-scope">Jenis</label>
			<select
				id="exp-scope"
				name="jenis"
				class="input"
				value={data.filter.scope ?? ''}
				onchange={submitOnChange}
			>
				<option value="">Semua</option>
				<option value="booking">Per booking</option>
				<option value="overhead">Overhead</option>
			</select>
		</div>
		<button type="submit" class="btn btn--secondary">Cari</button>
	</form>

	{#if data.rows.length === 0}
		<EmptyState message="Belum ada pengeluaran yang cocok." />
	{:else}
		<section class="card table-wrap">
			<table class="table" aria-label="Daftar pengeluaran">
				<thead>
					<tr>
						<th scope="col">Tanggal</th>
						<th scope="col">Kategori</th>
						<th scope="col">Untuk</th>
						<th scope="col">Metode</th>
						<th scope="col" class="text-right">Jumlah</th>
						<th scope="col"><span class="sr-only">Aksi</span></th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as r (r.id)}
						<tr data-scope={r.bookingId ? 'booking' : 'overhead'}>
							<td class="whitespace-nowrap">{dateID(r.spentOn)}</td>
							<td>
								{r.categoryName}
								{#if r.description}<span class="block text-small text-ink-2">{r.description}</span
									>{/if}
							</td>
							<td>
								{#if r.bookingId}
									{#if data.allow.bookings}
										<a
											class="underline-offset-2 hover:underline"
											href={resolve('/admin/(app)/booking/[id]', { id: r.bookingId })}
											>{r.bookingTitle}</a
										>
									{:else}{r.bookingTitle}{/if}
									<span class="block text-small text-ink-2">{r.clientName}</span>
								{:else}
									<span class="chip">Overhead</span>
								{/if}
							</td>
							<td>{PAYMENT_METHOD_LABEL[r.method]}</td>
							<td class="text-right tabular-nums">{rupiah(r.amount)}</td>
							<td class="text-right whitespace-nowrap">
								{#if r.receiptMediaId}
									<!-- eslint-disable svelte/no-navigation-without-resolve -- API route that redirects to a presigned file URL -->
									<a
										class="icon-btn"
										href="/admin/api/expense-receipts/{r.receiptMediaId}/file"
										target="_blank"
										rel="noopener noreferrer"
										aria-label="Lihat nota {dateID(r.spentOn)} {r.categoryName}"
									>
										<ImageIcon size={16} aria-hidden="true" />
									</a>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{/if}
								{#if data.allow.update}
									<button
										type="button"
										class="icon-btn"
										aria-label="Ubah pengeluaran {dateID(r.spentOn)} {r.categoryName}"
										onclick={() => openForm(r)}
									>
										<Pencil size={16} aria-hidden="true" />
									</button>
								{/if}
								{#if data.allow.delete}
									<button
										type="button"
										class="icon-btn"
										aria-label="Hapus pengeluaran {dateID(r.spentOn)} {r.categoryName}"
										onclick={() => {
											deleting = r;
											deleteOpen = true;
										}}
									>
										<Trash2 size={16} aria-hidden="true" />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

{#if data.allow.create || data.allow.update}
	<ExpenseDrawer
		bind:open={drawerOpen}
		expense={editing}
		categories={data.categories}
		bookings={data.bookings}
	/>
{/if}

<ConfirmDialog
	bind:open={deleteOpen}
	title="Hapus pengeluaran?"
	action="?/delete"
	fields={{ id: deleting?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	<strong>{deleting?.categoryName}</strong>
	{rupiah(deleting?.amount ?? 0)} pada {deleting ? dateID(deleting.spentOn) : ''} dihapus, beserta foto
	notanya.
</ConfirmDialog>
