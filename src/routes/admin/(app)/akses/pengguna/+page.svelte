<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import Modal from '#lib/components/admin/Modal.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import { refreshThenToast } from '#lib/enhance.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Credentials = { name: string; email: string; password: string };
	type Target = { id: string; name: string };

	let addOpen = $state(false);
	let addErrors = $state<Record<string, string>>({});
	let rolesFor = $state<(Target & { roleIds: string[] }) | null>(null);
	let rolesOpen = $state(false);
	let resetFor = $state<Target | null>(null);
	let resetOpen = $state(false);
	let resetErrors = $state<Record<string, string>>({});
	let activeFor = $state<(Target & { active: boolean }) | null>(null);
	let activeOpen = $state(false);
	let shown = $state<Credentials | null>(null);
	let shownOpen = $state(false);
	let busy = $state(false);

	/** Add / reset: field errors stay in the form; a generated password is shown once */
	const submit =
		(kind: 'add' | 'reset'): SubmitFunction =>
		() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					const fields = (result.data?.fields ?? {}) as Record<string, string>;
					if (kind === 'add') addErrors = fields;
					else resetErrors = fields;
					return;
				}
				if (result.type !== 'success') return;
				await update({ navigate: false });
				if (kind === 'add') addOpen = false;
				else resetOpen = false;
				toast.success(String(result.data?.done));
				const creds = result.data?.credentials as Credentials | null;
				if (creds) {
					shown = creds;
					shownOpen = true;
				}
			};
		};

	async function copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success('Kata sandi disalin.');
		} catch {
			toast.error('Tidak bisa menyalin. Salin manual.');
		}
	}
</script>

<div class="page-body">
	<PageHeader
		title="Pengguna"
		description="Siapa saja yang bisa masuk ke admin. Pendaftaran publik dimatikan."
	>
		{#snippet actions()}
			<button
				type="button"
				class="btn btn--primary"
				onclick={() => {
					addErrors = {};
					addOpen = true;
				}}
			>
				<UserPlus size={16} aria-hidden="true" /> Tambah pengguna
			</button>
		{/snippet}
	</PageHeader>

	<section class="card table-wrap" aria-label="Daftar pengguna">
		<table class="table min-w-[44rem]">
			<thead>
				<tr>
					<th scope="col">Nama</th>
					<th scope="col">Peran</th>
					<th scope="col">Status</th>
					<th scope="col"><span class="sr-only">Aksi</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as u (u.id)}
					<tr>
						<td>
							<span class="block font-semibold">
								{u.name}{#if u.id === data.meId}<span class="ml-1.5 font-normal text-ink-2"
										>(Anda)</span
									>{/if}
							</span>
							<span class="block text-small text-ink-2">{u.email}</span>
						</td>
						<td>
							{#if u.isOwner}
								<span class="chip chip--success">Pemilik · akses penuh</span>
							{:else if u.roles.length}
								<span class="flex flex-wrap gap-1">
									{#each u.roles as r (r.id)}<span class="chip">{r.name}</span>{/each}
								</span>
							{:else}
								<span class="text-small text-ink-2">Belum ada peran</span>
							{/if}
						</td>
						<td>
							{#if u.active}<span class="chip chip--success">Aktif</span>{:else}<span
									class="chip chip--danger">Nonaktif</span
								>{/if}
						</td>
						<td>
							<span class="flex flex-wrap justify-end gap-1.5">
								{#if !u.isOwner}
									<button
										type="button"
										class="btn btn--secondary btn--sm"
										onclick={() => {
											rolesFor = { id: u.id, name: u.name, roleIds: u.roles.map((r) => r.id) };
											rolesOpen = true;
										}}
									>
										<ShieldCheck size={14} aria-hidden="true" /> Ubah peran
									</button>
								{/if}
								<button
									type="button"
									class="btn btn--secondary btn--sm"
									onclick={() => {
										resetFor = { id: u.id, name: u.name };
										resetErrors = {};
										resetOpen = true;
									}}
								>
									<KeyRound size={14} aria-hidden="true" /> Reset kata sandi
								</button>
								{#if !u.isOwner}
									<button
										type="button"
										class="btn btn--ghost btn--sm"
										onclick={() => {
											activeFor = { id: u.id, name: u.name, active: u.active };
											activeOpen = true;
										}}
									>
										{u.active ? 'Nonaktifkan' : 'Aktifkan'}
									</button>
								{/if}
							</span>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>

{#snippet roleChecks(selected: string[])}
	{#if data.roles.length}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-1 text-small font-semibold">Peran</legend>
			{#each data.roles as r (r.id)}
				<label class="flex min-h-10 items-center gap-3">
					<input
						type="checkbox"
						class="checkbox"
						name="roleIds"
						value={r.id}
						checked={selected.includes(r.id)}
					/>
					{r.name}
				</label>
			{/each}
		</fieldset>
	{:else}
		<p class="text-small text-ink-2">
			Belum ada peran. <a class="underline" href={resolve('admin/akses/peran')}>Buat peran</a> dulu; tanpa
			peran pengguna tidak bisa membuka menu apa pun.
		</p>
	{/if}
{/snippet}

<Drawer
	bind:open={addOpen}
	title="Tambah pengguna"
	description="Langsung bisa masuk dengan email dan kata sandi ini."
>
	<form
		id="add-user"
		method="post"
		action="?/add"
		use:enhance={submit('add')}
		class="flex flex-col gap-4"
		novalidate
	>
		<Field label="Nama" name="name" required errors={addErrors.name ? [addErrors.name] : undefined}>
			{#snippet children(attrs)}
				<input {...attrs} class="input" autocomplete="off" maxlength="80" />
			{/snippet}
		</Field>
		<Field
			label="Email"
			name="email"
			required
			errors={addErrors.email ? [addErrors.email] : undefined}
		>
			{#snippet children(attrs)}
				<input {...attrs} class="input" type="email" autocomplete="off" maxlength="200" />
			{/snippet}
		</Field>
		<Field
			label="Kata sandi sementara"
			name="password"
			hint="Kosongkan agar dibuat otomatis (ditampilkan sekali)"
			errors={addErrors.password ? [addErrors.password] : undefined}
		>
			{#snippet children(attrs)}
				<input {...attrs} class="input" type="password" autocomplete="new-password" />
			{/snippet}
		</Field>
		{@render roleChecks([])}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (addOpen = false)}>Batal</button
		>
		<button type="submit" form="add-user" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Tambah pengguna'}
		</button>
	{/snippet}
</Drawer>

<Drawer
	bind:open={rolesOpen}
	title="Ubah peran"
	description="{rolesFor?.name ?? ''}: berlaku pada halaman berikutnya yang dibuka."
>
	<form
		id="user-roles"
		method="post"
		action="?/setRoles"
		use:enhance={refreshThenToast({
			start: () => (busy = true),
			end: (ok) => {
				busy = false;
				if (ok) rolesOpen = false;
			}
		})}
		class="flex flex-col gap-4"
	>
		<input type="hidden" name="userId" value={rolesFor?.id ?? ''} />
		{#key rolesFor?.id}{@render roleChecks(rolesFor?.roleIds ?? [])}{/key}
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (rolesOpen = false)}
			>Batal</button
		>
		<button type="submit" form="user-roles" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Simpan peran'}
		</button>
	{/snippet}
</Drawer>

<Modal bind:open={resetOpen} title="Reset kata sandi" description={resetFor?.name}>
	<form
		id="reset-password"
		method="post"
		action="?/resetPassword"
		use:enhance={submit('reset')}
		class="flex flex-col gap-4"
		novalidate
	>
		<input type="hidden" name="userId" value={resetFor?.id ?? ''} />
		<p class="text-body text-ink-2">
			Kata sandi lama berhenti berlaku dan {resetFor?.name ?? 'pengguna ini'} keluar dari semua perangkat.
		</p>
		<Field
			label="Kata sandi baru"
			name="password"
			hint="Kosongkan agar dibuat otomatis (ditampilkan sekali)"
			errors={resetErrors.password ? [resetErrors.password] : undefined}
		>
			{#snippet children(attrs)}
				<input {...attrs} class="input" type="password" autocomplete="new-password" />
			{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (resetOpen = false)}
			>Batal</button
		>
		<button type="submit" form="reset-password" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Ganti kata sandi'}
		</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={activeOpen}
	title={activeFor?.active ? 'Nonaktifkan pengguna?' : 'Aktifkan pengguna?'}
	action="?/setActive"
	fields={{ userId: activeFor?.id ?? '', active: activeFor?.active ? 'false' : 'true' }}
	confirmLabel={activeFor?.active ? 'Nonaktifkan' : 'Aktifkan'}
	tone={activeFor?.active ? 'danger' : 'dark'}
>
	{#if activeFor?.active}
		<strong>{activeFor?.name}</strong> tidak bisa masuk lagi dan langsung keluar dari semua perangkat.
		Datanya tetap tersimpan.
	{:else}
		<strong>{activeFor?.name}</strong> bisa masuk lagi dengan kata sandi terakhirnya.
	{/if}
</ConfirmDialog>

<Modal bind:open={shownOpen} title="Kata sandi sementara" description={shown?.name}>
	{#if shown}
		<div class="flex flex-col gap-3">
			<p class="text-body text-ink-2">
				Berikan kata sandi ini ke {shown.name}{shown.email ? ` (${shown.email})` : ''}. Simpan
				sekarang: tidak akan ditampilkan lagi.
			</p>
			<div class="flex items-center gap-2 rounded-card border border-line bg-sage-20 px-3 py-2.5">
				<code
					class="min-w-0 flex-1 font-mono text-[0.9375rem] font-semibold break-all"
					data-testid="new-password">{shown.password}</code
				>
				<button
					type="button"
					class="icon-btn"
					aria-label="Salin kata sandi"
					onclick={() => copy(shown!.password)}
				>
					<Copy size={16} aria-hidden="true" />
				</button>
			</div>
		</div>
	{/if}
	{#snippet footer()}
		<button
			type="button"
			class="btn btn--primary"
			onclick={() => {
				shownOpen = false;
				shown = null;
			}}>Sudah disimpan</button
		>
	{/snippet}
</Modal>
