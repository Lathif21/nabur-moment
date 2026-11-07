<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Package from '@lucide/svelte/icons/package';
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
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import { postAction, refreshThenToast } from '#lib/enhance.ts';
	import { rupiah } from '#lib/format.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Pkg = (typeof data.packages)[number];
	type Addon = (typeof data.addons)[number];
	type Category = (typeof data.categories)[number];

	const TABS = [
		{ key: 'packages', label: 'Paket' },
		{ key: 'addons', label: 'Add-on' },
		{ key: 'categories', label: 'Kategori' }
	] as const;
	let tab = $state<(typeof TABS)[number]['key']>('packages');

	// svelte-ignore state_referenced_locally
	let media = $state<Record<string, MediaItem>>({ ...data.media });
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	let pkgOpen = $state(false);
	let pkgEdit = $state<Pkg | null>(null);
	let pkgCategory = $state('');
	let pkgPrice = $state<number | null>(null);
	let pkgImage = $state<string | null>(null);

	let addonOpen = $state(false);
	let addonEdit = $state<Addon | null>(null);
	let addonPrice = $state<number | null>(null);

	let catOpen = $state(false);
	let catEdit = $state<Category | null>(null);

	let confirm = $state<{ action: string; id: string; title: string; text: string } | null>(null);
	let confirmOpen = $state(false);

	function editPackage(p: Pkg | null, categoryId?: string) {
		pkgEdit = p;
		pkgCategory = p?.categoryId ?? categoryId ?? data.categories[0]?.id ?? '';
		pkgPrice = p?.price ?? null;
		pkgImage = p?.imageMediaId ?? null;
		errors = {};
		pkgOpen = true;
	}

	function editAddon(a: Addon | null) {
		addonEdit = a;
		addonPrice = a?.price ?? null;
		errors = {};
		addonOpen = true;
	}

	function editCategory(c: Category | null) {
		catEdit = c;
		errors = {};
		catOpen = true;
	}

	function ask(action: string, id: string, title: string, text: string) {
		confirm = { action, id, title, text };
		confirmOpen = true;
	}

	/** Drawer forms: field errors stay inline, success closes the drawer */
	const submit =
		(close: () => void): SubmitFunction =>
		() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					errors = (result.data?.fields ?? {}) as Record<string, string>;
					if (result.data?.error) toast.error(String(result.data.error));
					return;
				}
				await update({ navigate: false });
				close();
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		};

	async function reorder(action: string, ids: string[]) {
		const error = await postAction(action, { ids: ids.join(',') });
		if (error) toast.error(error);
	}

	const packagesOf = (categoryId: string) =>
		data.packages.filter((p) => p.categoryId === categoryId);
	const err = (k: string) => (errors[k] ? [errors[k]] : undefined);
</script>

<div class="page-body">
	<PageHeader
		title="Paket"
		description="Paket, add-on, dan kategorinya. Satu tombol Terbitkan untuk semuanya."
	>
		{#snippet actions()}
			{#if data.can.create}
				{#if tab === 'packages'}
					<button
						type="button"
						class="btn btn--secondary"
						disabled={!data.categories.length}
						onclick={() => editPackage(null)}
					>
						<Plus size={16} aria-hidden="true" /> Paket
					</button>
				{:else if tab === 'addons'}
					<button type="button" class="btn btn--secondary" onclick={() => editAddon(null)}>
						<Plus size={16} aria-hidden="true" /> Add-on
					</button>
				{:else}
					<button type="button" class="btn btn--secondary" onclick={() => editCategory(null)}>
						<Plus size={16} aria-hidden="true" /> Kategori
					</button>
				{/if}
			{/if}
		{/snippet}
	</PageHeader>

	<PublishBar
		dirty={data.status.dirty}
		publishedAt={data.status.publishedAt}
		canPublish={data.can.update}
	/>

	<div class="flex gap-1.5" role="tablist" aria-label="Bagian paket">
		{#each TABS as t (t.key)}
			<button
				type="button"
				role="tab"
				id="tab-{t.key}"
				aria-selected={tab === t.key}
				aria-controls="panel-{t.key}"
				class={['btn btn--sm', tab === t.key ? 'btn--primary' : 'btn--secondary']}
				onclick={() => (tab = t.key)}>{t.label}</button
			>
		{/each}
	</div>

	{#snippet rowActions(
		kind: string,
		id: string,
		name: string,
		onedit: () => void,
		ondelete: () => void,
		visible?: boolean
	)}
		<div class="flex items-center gap-1">
			{#if data.can.update && visible !== undefined}
				<form method="post" action="?/visiblePackage" use:enhance={refreshThenToast()}>
					<input type="hidden" name="id" value={id} />
					<input type="hidden" name="visible" value={visible ? 'false' : 'true'} />
					<button
						type="submit"
						class="icon-btn"
						aria-label="{visible ? 'Sembunyikan' : 'Tampilkan'} {kind} {name}"
					>
						{#if visible}<Eye size={16} aria-hidden="true" />{:else}<EyeOff
								size={16}
								aria-hidden="true"
							/>{/if}
					</button>
				</form>
			{/if}
			{#if data.can.update}
				<button type="button" class="icon-btn" aria-label="Ubah {kind} {name}" onclick={onedit}>
					<PencilLine size={16} aria-hidden="true" />
				</button>
			{/if}
			{#if data.can.delete}
				<button
					type="button"
					class="icon-btn text-danger"
					aria-label="Hapus {kind} {name}"
					onclick={ondelete}
				>
					<Trash2 size={16} aria-hidden="true" />
				</button>
			{/if}
		</div>
	{/snippet}

	{#if tab === 'packages'}
		<div
			id="panel-packages"
			role="tabpanel"
			aria-labelledby="tab-packages"
			class="flex flex-col gap-6"
		>
			{#if !data.categories.length}
				<EmptyState icon={Package} message="Buat kategori dulu di tab Kategori." />
			{/if}
			{#each data.categories as c (c.id)}
				{@const list = packagesOf(c.id)}
				<section class="flex flex-col gap-2" aria-labelledby="cat-{c.id}">
					<div class="flex items-center justify-between gap-2">
						<h2 id="cat-{c.id}" class="font-display text-section-title">{c.name}</h2>
						{#if data.can.create}
							<button
								type="button"
								class="btn btn--ghost btn--sm"
								onclick={() => editPackage(null, c.id)}
							>
								<Plus size={14} aria-hidden="true" /> Paket <span class="sr-only">di {c.name}</span>
							</button>
						{/if}
					</div>
					{#if list.length}
						<SortableList
							items={list}
							label="Urutan paket {c.name}"
							itemName={(p) => p.name}
							onreorder={(ids) => reorder('?/reorderPackages', ids)}
							disabled={!data.can.update}
						>
							{#snippet row(p)}
								{@const pic = p.imageMediaId ? media[p.imageMediaId] : undefined}
								<div class="flex flex-wrap items-center gap-3">
									{#if pic?.thumb}
										<img
											src={pic.thumb}
											alt=""
											class="size-12 shrink-0 rounded-card object-cover"
										/>
									{/if}
									<div class={['min-w-0 flex-1', !p.visible && 'opacity-60']}>
										<p class="flex flex-wrap items-center gap-2 font-semibold">
											{p.name}
											{#if p.featured}<span class="chip chip--success">Unggulan</span>{/if}
											{#if !p.visible}<span class="chip">Disembunyikan</span>{/if}
										</p>
										<p class="text-small text-ink-2 tabular-nums">
											{rupiah(p.price)} · {p.inclusions.length} item
										</p>
									</div>
									{@render rowActions(
										'paket',
										p.id,
										p.name,
										() => editPackage(p),
										() =>
											ask(
												'?/deletePackage',
												p.id,
												'Hapus paket?',
												`Paket ${p.name} akan dihapus. Jika sudah terbit, paket tetap tampil di situs sampai Paket diterbitkan lagi.`
											),
										p.visible
									)}
								</div>
							{/snippet}
						</SortableList>
					{:else}
						<p class="text-small text-ink-2">Belum ada paket di kategori ini.</p>
					{/if}
				</section>
			{/each}
		</div>
	{:else if tab === 'addons'}
		<div id="panel-addons" role="tabpanel" aria-labelledby="tab-addons">
			{#if data.addons.length}
				<SortableList
					items={data.addons}
					label="Urutan add-on"
					itemName={(a) => a.name}
					onreorder={(ids) => reorder('?/reorderAddons', ids)}
					disabled={!data.can.update}
				>
					{#snippet row(a)}
						<div class="flex flex-wrap items-center gap-3">
							<div class={['min-w-0 flex-1', !a.active && 'opacity-60']}>
								<p class="flex flex-wrap items-center gap-2 font-semibold">
									{a.name}
									{#if !a.showOnSite}<span class="chip">Tidak di situs</span>{/if}
									{#if !a.active}<span class="chip chip--danger">Nonaktif</span>{/if}
								</p>
								<p class="text-small text-ink-2 tabular-nums">{rupiah(a.price)}</p>
							</div>
							{@render rowActions(
								'add-on',
								a.id,
								a.name,
								() => editAddon(a),
								() => ask('?/deleteAddon', a.id, 'Hapus add-on?', `Add-on ${a.name} akan dihapus.`)
							)}
						</div>
					{/snippet}
				</SortableList>
			{:else}
				<EmptyState icon={Package} message="Belum ada add-on, misalnya drone atau kru tambahan." />
			{/if}
		</div>
	{:else}
		<div id="panel-categories" role="tabpanel" aria-labelledby="tab-categories">
			<SortableList
				items={data.categories}
				label="Urutan kategori"
				itemName={(c) => c.name}
				onreorder={(ids) => reorder('?/reorderCategories', ids)}
				disabled={!data.can.update}
			>
				{#snippet row(c)}
					<div class="flex items-center gap-3">
						<div class="min-w-0 flex-1">
							<p class="font-semibold">{c.name}</p>
							<p class="text-small text-ink-2">{c.packages} paket</p>
						</div>
						{@render rowActions(
							'kategori',
							c.id,
							c.name,
							() => editCategory(c),
							() =>
								ask(
									'?/deleteCategory',
									c.id,
									'Hapus kategori?',
									`Kategori ${c.name} akan dihapus. Kategori yang masih berisi paket tidak bisa dihapus.`
								)
						)}
					</div>
				{/snippet}
			</SortableList>
		</div>
	{/if}
</div>

<Drawer
	bind:open={pkgOpen}
	title={pkgEdit ? 'Ubah paket' : 'Paket baru'}
	description="Tampil di situs setelah Terbitkan."
>
	<form
		id="package-form"
		method="post"
		action="?/savePackage"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={submit(() => (pkgOpen = false))}
	>
		{#key pkgEdit?.id ?? pkgCategory}
			<input type="hidden" name="id" value={pkgEdit?.id ?? ''} />
			<Field label="Kategori" name="categoryId" required errors={err('categoryId')}>
				{#snippet children(attrs)}
					<select {...attrs} class="input" bind:value={pkgCategory}>
						{#each data.categories as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Nama paket" name="name" required errors={err('name')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="80" defaultValue={pkgEdit?.name ?? ''} />
				{/snippet}
			</Field>
			<Field
				label="Harga"
				name="price"
				required
				errors={err('price')}
				hint={pkgPrice ? rupiah(pkgPrice) : undefined}
			>
				{#snippet children(attrs)}
					<MoneyInput {...attrs} bind:value={pkgPrice} />
				{/snippet}
			</Field>
			<Field
				label="Yang didapat"
				name="inclusions"
				hint="Satu poin per baris."
				errors={err('inclusions')}
			>
				{#snippet children(attrs)}
					<textarea
						{...attrs}
						class="input min-h-36"
						defaultValue={pkgEdit?.inclusions.join('\n') ?? ''}></textarea>
				{/snippet}
			</Field>
			<Field label="Catatan kecil" name="note" hint="Opsional, misalnya syarat lokasi.">
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="300" defaultValue={pkgEdit?.note ?? ''} />
				{/snippet}
			</Field>
			<ImagePickField name="imageMediaId" label="Gambar (opsional)" bind:value={pkgImage} {media} />
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="featured"
					checked={pkgEdit?.featured ?? false}
				/>
				Paket unggulan (kartu disorot)
			</label>
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="visible"
					checked={pkgEdit ? pkgEdit.visible : true}
				/>
				Tampilkan di situs
			</label>
		{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (pkgOpen = false)}>Batal</button
		>
		<button type="submit" form="package-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>

<Drawer bind:open={addonOpen} title={addonEdit ? 'Ubah add-on' : 'Add-on baru'}>
	<form
		id="addon-form"
		method="post"
		action="?/saveAddon"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={submit(() => (addonOpen = false))}
	>
		{#key addonEdit?.id}
			<input type="hidden" name="id" value={addonEdit?.id ?? ''} />
			<Field label="Nama" name="name" required errors={err('name')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="80" defaultValue={addonEdit?.name ?? ''} />
				{/snippet}
			</Field>
			<Field label="Harga" name="price" required errors={err('price')}>
				{#snippet children(attrs)}
					<MoneyInput {...attrs} bind:value={addonPrice} />
				{/snippet}
			</Field>
			<Field label="Keterangan" name="description">
				{#snippet children(attrs)}
					<textarea
						{...attrs}
						class="input min-h-20"
						maxlength="300"
						defaultValue={addonEdit?.description ?? ''}></textarea>
				{/snippet}
			</Field>
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="showOnSite"
					checked={addonEdit ? addonEdit.showOnSite : true}
				/>
				Tampilkan di situs
			</label>
			<label class="flex min-h-10 items-center gap-3">
				<input
					type="checkbox"
					class="checkbox"
					name="active"
					checked={addonEdit ? addonEdit.active : true}
				/>
				Aktif (bisa dipilih di booking baru)
			</label>
		{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (addonOpen = false)}
			>Batal</button
		>
		<button type="submit" form="addon-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>

<Drawer bind:open={catOpen} title={catEdit ? 'Ubah kategori' : 'Kategori baru'}>
	<form
		id="category-form"
		method="post"
		action="?/saveCategory"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={submit(() => (catOpen = false))}
	>
		{#key catEdit?.id}
			<input type="hidden" name="id" value={catEdit?.id ?? ''} />
			<Field label="Nama kategori" name="name" required errors={err('name')}>
				{#snippet children(attrs)}
					<input {...attrs} class="input" maxlength="60" defaultValue={catEdit?.name ?? ''} />
				{/snippet}
			</Field>
		{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (catOpen = false)}>Batal</button
		>
		<button type="submit" form="category-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirm?.title ?? ''}
	action={confirm?.action ?? ''}
	fields={{ id: confirm?.id ?? '' }}
	confirmLabel="Hapus"
	tone="danger"
>
	{confirm?.text}
</ConfirmDialog>
