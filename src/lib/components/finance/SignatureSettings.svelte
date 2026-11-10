<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import X from '@lucide/svelte/icons/x';
	import { refreshThenToast } from '#lib/enhance.ts';
	import { prepareSignature, uploadSignature } from '#lib/media/signature.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		/** Short-lived link to the current PNG, null = none yet */
		preview: string | null;
		name: string;
		title: string;
	};

	let { preview, name, title }: Props = $props();

	let fileInput = $state<HTMLInputElement>();
	let uploading = $state(false);
	let saving = $state(false);

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		try {
			const png = await prepareSignature(file);
			await uploadSignature(png, resolve('/admin/api/settings/signature'));
			await invalidateAll();
			toast.success('Tanda tangan disimpan.');
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			uploading = false;
		}
	}
</script>

<!-- Signature (ttd) printed on every invoice and kwitansi. Owner only. -->
<section class="card flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="signature-title">
	<h2 id="signature-title" class="font-display text-section-title">Tanda tangan</h2>
	<p class="text-small text-ink-2">
		Dicetak di setiap invoice dan kwitansi. Unggah foto tanda tangan dengan tinta gelap di kertas
		terang; latar belakangnya dibuat transparan otomatis. Hanya pemilik yang bisa mengubahnya.
	</p>

	<div
		class="flex min-h-28 items-center justify-center rounded-card border border-dashed border-line bg-surface p-3"
	>
		{#if preview}
			<img src={preview} alt="Tanda tangan saat ini" class="max-h-24 max-w-full object-contain" />
		{:else}
			<p class="text-small text-ink-2">Belum ada tanda tangan. PDF memakai garis kosong.</p>
		{/if}
	</div>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/png,image/jpeg,image/webp,image/heic"
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		onchange={pick}
	/>
	<div class="flex flex-wrap gap-2">
		<button
			type="button"
			class="btn btn--secondary btn--sm"
			disabled={uploading}
			onclick={() => fileInput?.click()}
		>
			<PenLine size={16} aria-hidden="true" />
			{uploading ? 'Mengunggah…' : preview ? 'Ganti tanda tangan' : 'Unggah tanda tangan'}
		</button>
		{#if preview}
			<form method="post" action="?/removeSignature" use:enhance={refreshThenToast()}>
				<button type="submit" class="btn btn--ghost btn--sm text-danger">
					<X size={16} aria-hidden="true" /> Hapus
				</button>
			</form>
		{/if}
	</div>

	<form
		method="post"
		action="?/signer"
		class="grid gap-4 sm:grid-cols-2"
		use:enhance={refreshThenToast({
			start: () => (saving = true),
			end: () => (saving = false)
		})}
	>
		<div class="field">
			<label for="signer-name">Nama di bawah tanda tangan</label>
			<input
				id="signer-name"
				name="signerName"
				class="input"
				maxlength="80"
				placeholder="Kosong = nama usaha"
				defaultValue={name}
			/>
		</div>
		<div class="field">
			<label for="signer-title">Jabatan</label>
			<input
				id="signer-title"
				name="signerTitle"
				class="input"
				maxlength="60"
				placeholder="Misal Owner"
				defaultValue={title}
			/>
		</div>
		<div class="flex justify-end sm:col-span-2">
			<button type="submit" class="btn btn--primary btn--sm" disabled={saving}>
				{saving ? 'Menyimpan…' : 'Simpan nama'}
			</button>
		</div>
	</form>
</section>
