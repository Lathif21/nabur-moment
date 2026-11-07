<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { SvelteSet } from 'svelte/reactivity';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import {
		ACTION_LABELS,
		type CrudAction,
		GRANTABLE_MODULES,
		normalizeGrants
	} from '#lib/permissions.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Column order in the matrix: Lihat · Tambah · Ubah · Hapus
	const COLUMNS: CrudAction[] = ['read', 'create', 'update', 'delete'];
	const GROUPS = ['CRM', 'Keuangan', 'Konten', 'Pengaturan'] as const;
	type Mod = (typeof GRANTABLE_MODULES)[number];

	// The page data is the initial state; after "Simpan" the reloaded data resets it
	// svelte-ignore state_referenced_locally
	const ticks = new SvelteSet<string>(data.role.grants);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	const has = (m: Mod, a: CrudAction) => (m.actions as readonly CrudAction[]).includes(a);
	const key = (m: Mod, a: CrudAction) => `${m.key}:${a}`;

	/** C/U/D ticks R; unticking R clears the row */
	function set(m: Mod, a: CrudAction, on: boolean) {
		if (!has(m, a)) return;
		if (on) {
			ticks.add(key(m, a));
			ticks.add(key(m, 'read'));
		} else if (a === 'read') {
			for (const x of COLUMNS) ticks.delete(key(m, x));
		} else {
			ticks.delete(key(m, a));
		}
	}

	const rowFull = (m: Mod) => m.actions.every((a) => ticks.has(key(m, a)));
	function toggleRow(m: Mod) {
		const on = !rowFull(m);
		for (const a of m.actions) set(m, a, on);
	}

	const colModules = (a: CrudAction) => GRANTABLE_MODULES.filter((m) => has(m, a));
	const colFull = (a: CrudAction) => colModules(a).every((m) => ticks.has(key(m, a)));
	function toggleCol(a: CrudAction) {
		const on = !colFull(a);
		for (const m of colModules(a)) set(m, a, on);
	}

	const count = $derived(
		normalizeGrants(
			[...ticks].map((t) => {
				const [module, action] = t.split(':') as [string, CrudAction];
				return { module, action };
			})
		).length
	);
</script>

<div class="page-body">
	<a
		href={resolve('admin/akses/peran')}
		class="inline-flex min-h-10 w-fit items-center gap-1.5 text-small font-semibold text-olive underline-offset-4 hover:underline"
	>
		<ArrowLeft size={15} aria-hidden="true" /> Semua peran
	</a>
	<PageHeader
		title={data.role.name}
		description="Centang menu dan tindakan yang boleh dipakai. Berlaku pada halaman berikutnya yang dibuka pengguna."
	/>

	<form
		method="post"
		action="?/save"
		class="flex flex-col gap-5"
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
				errors = {};
				await update({ reset: false, invalidateAll: true });
				if (result.type === 'success') toast.success(String(result.data?.done));
			};
		}}
	>
		<section class="card grid gap-4 p-5 sm:grid-cols-2" aria-label="Data peran">
			<Field
				label="Nama peran"
				name="name"
				required
				errors={errors.name ? [errors.name] : undefined}
			>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						maxlength="60"
						autocomplete="off"
						defaultValue={data.role.name}
					/>
				{/snippet}
			</Field>
			<Field label="Keterangan" name="description" hint="Opsional">
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						maxlength="200"
						autocomplete="off"
						defaultValue={data.role.description ?? ''}
					/>
				{/snippet}
			</Field>
		</section>

		<section class="card table-wrap" aria-label="Matriks akses">
			<table class="table min-w-[40rem]">
				<caption class="sr-only">Akses per menu</caption>
				<thead>
					<tr>
						<th scope="col">Menu</th>
						{#each COLUMNS as a (a)}
							<th scope="col" class="text-center!">
								<span class="flex flex-col items-center gap-1">
									{ACTION_LABELS[a]}
									<button
										type="button"
										class="text-[0.6875rem] font-normal text-olive underline underline-offset-2"
										onclick={() => toggleCol(a)}
										aria-label="{colFull(a) ? 'Hapus semua' : 'Pilih semua'} kolom {ACTION_LABELS[
											a
										]}"
									>
										{colFull(a) ? 'hapus semua' : 'pilih semua'}
									</button>
								</span>
							</th>
						{/each}
						<th scope="col"><span class="sr-only">Pilih baris</span></th>
					</tr>
				</thead>
				{#each GROUPS as group (group)}
					<tbody>
						<tr>
							<th
								scope="rowgroup"
								colspan={COLUMNS.length + 2}
								class="bg-sage-20 eyebrow text-[0.6875rem]! text-ink!">{group}</th
							>
						</tr>
						{#each GRANTABLE_MODULES.filter((m) => m.group === group) as m (m.key)}
							<tr>
								<th scope="row">{m.label}</th>
								{#each COLUMNS as a (a)}
									<td class="text-center">
										{#if has(m, a)}
											<input
												type="checkbox"
												class="checkbox align-middle"
												name="grant"
												value={key(m, a)}
												checked={ticks.has(key(m, a))}
												onchange={(e) => set(m, a, e.currentTarget.checked)}
												aria-label="{ACTION_LABELS[a]} {m.label}"
											/>
										{:else}
											<span class="text-ink-2" aria-hidden="true">–</span>
											<span class="sr-only">{ACTION_LABELS[a]} tidak tersedia</span>
										{/if}
									</td>
								{/each}
								<td class="text-right">
									<button
										type="button"
										class="text-small text-olive underline underline-offset-2"
										onclick={() => toggleRow(m)}
										aria-label="{rowFull(m) ? 'Hapus semua' : 'Pilih semua'} untuk {m.label}"
									>
										{rowFull(m) ? 'hapus semua' : 'pilih semua'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				{/each}
			</table>
		</section>

		<p class="text-small text-ink-2">
			Akses &amp; Peran hanya untuk pemilik dan tidak bisa diberikan lewat peran. Tambah, Ubah, atau
			Hapus otomatis mencentang Lihat.
		</p>

		<div class="flex items-center justify-end gap-3">
			<span class="text-small text-ink-2" aria-live="polite">{count} izin dipilih</span>
			<button type="submit" class="btn btn--primary" disabled={busy}>
				{busy ? 'Menyimpan…' : 'Simpan'}
			</button>
		</div>
	</form>
</div>
