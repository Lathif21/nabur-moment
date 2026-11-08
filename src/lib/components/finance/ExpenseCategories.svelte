<script lang="ts">
	// Expense categories card (Pengaturan → Bisnis & Keuangan, P3-05): rename, add, archive,
	// delete when unused. Posts to the hosting page's ?/category, ?/archiveCategory, ?/deleteCategory.
	import { enhance } from '$app/forms';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-arrow-up';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { refreshThenToast } from '#lib/enhance.ts';

	type Category = { id: string; name: string; archived: boolean; used: number };
	type Props = {
		categories: Category[];
		canCreate: boolean;
		canEdit: boolean;
		canDelete: boolean;
	};

	let { categories, canCreate, canEdit, canDelete }: Props = $props();
	let newName = $state('');
</script>

<section class="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="cat-title">
	<div>
		<h2 id="cat-title" class="font-display text-section-title">Kategori pengeluaran</h2>
		<p class="text-small text-ink-2">
			Kategori yang sudah dipakai tidak bisa dihapus; arsipkan agar tidak muncul di formulir.
		</p>
	</div>

	<ul class="flex flex-col divide-y divide-line">
		{#each categories as c (c.id)}
			<li class="flex flex-wrap items-center gap-2 py-2" data-archived={c.archived}>
				{#if canEdit}
					<form
						method="post"
						action="?/category"
						class="flex min-w-48 flex-1 items-center gap-2"
						use:enhance={refreshThenToast()}
					>
						<input type="hidden" name="id" value={c.id} />
						<label class="sr-only" for="cat-{c.id}">Nama kategori {c.name}</label>
						<input id="cat-{c.id}" name="name" class="input" maxlength="60" defaultValue={c.name} />
						<button type="submit" class="btn btn--ghost" aria-label="Simpan kategori {c.name}"
							>Simpan</button
						>
					</form>
				{:else}
					<span class="flex-1">{c.name}</span>
				{/if}
				<span class="text-small whitespace-nowrap text-ink-2">{c.used} dipakai</span>
				{#if c.archived}<span class="chip">Diarsipkan</span>{/if}
				{#if canEdit}
					<form method="post" action="?/archiveCategory" use:enhance={refreshThenToast()}>
						<input type="hidden" name="id" value={c.id} />
						<input type="hidden" name="archived" value={c.archived ? 'false' : 'true'} />
						<button
							type="submit"
							class="icon-btn"
							aria-label="{c.archived ? 'Aktifkan lagi' : 'Arsipkan'} kategori {c.name}"
						>
							{#if c.archived}<ArchiveRestore size={16} aria-hidden="true" />{:else}<Archive
									size={16}
									aria-hidden="true"
								/>{/if}
						</button>
					</form>
				{/if}
				{#if canDelete && c.used === 0}
					<form method="post" action="?/deleteCategory" use:enhance={refreshThenToast()}>
						<input type="hidden" name="id" value={c.id} />
						<button type="submit" class="icon-btn" aria-label="Hapus kategori {c.name}">
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	{#if canCreate}
		<form
			method="post"
			action="?/category"
			class="flex flex-wrap items-end gap-2"
			use:enhance={refreshThenToast({ end: (ok) => ok && (newName = '') })}
		>
			<div class="field min-w-48 flex-1">
				<label for="cat-new">Kategori baru</label>
				<input id="cat-new" name="name" class="input" maxlength="60" bind:value={newName} />
			</div>
			<button type="submit" class="btn btn--secondary" disabled={!newName.trim()}>
				<Plus size={16} aria-hidden="true" /> Tambah
			</button>
		</form>
	{/if}
</section>
