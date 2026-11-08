<script lang="ts">
	// One private image (payment proof, expense receipt): the browser PUTs the file straight to the
	// private bucket with a presigned URL (P3-04 / P3-05), then confirms. Posts the media id in a
	// hidden field. `endpoint` is the API base, e.g. "/admin/api/payment-proofs".
	import { PROOF_MAX_BYTES, PROOF_MIME } from '#lib/schemas/finance.ts';

	type Props = {
		id: string;
		label: string;
		/** Hidden field name that posts the media id */
		name: string;
		endpoint: string;
		/** Chosen media id ('' = none) */
		value: string;
		/** A file is being uploaded (the form should wait) */
		uploading?: boolean;
		/** Server-side error for this field */
		error?: string;
		hint?: string;
	};

	let {
		id,
		label,
		name,
		endpoint,
		value = $bindable(),
		uploading = $bindable(false),
		error,
		hint = 'JPG / PNG / WebP, maks. 10 MB. Disimpan privat.'
	}: Props = $props();

	let filename = $state('');
	let localError = $state('');
	const shown = $derived(localError || error || '');

	async function upload(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		localError = '';
		if (!file) return;
		if (!(PROOF_MIME as readonly string[]).includes(file.type)) {
			localError = 'File harus berupa gambar JPG, PNG, atau WebP.';
			return;
		}
		if (file.size > PROOF_MAX_BYTES) {
			localError = 'Ukuran file maksimal 10 MB.';
			return;
		}
		uploading = true;
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ filename: file.name, mime: file.type, bytes: file.size })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message);
			const made = (await res.json()) as {
				id: string;
				upload: { url: string; headers: Record<string, string> };
			};
			const put = await fetch(made.upload.url, {
				method: 'PUT',
				headers: made.upload.headers,
				body: file
			});
			if (!put.ok) throw new Error();
			const ok = await fetch(`${endpoint}/${made.id}/confirm`, { method: 'POST' });
			if (!ok.ok) throw new Error((await ok.json().catch(() => null))?.message);
			value = made.id;
			filename = file.name;
		} catch (err) {
			localError =
				err instanceof Error && err.message ? err.message : 'File gagal diunggah. Coba lagi.';
		} finally {
			uploading = false;
		}
	}
</script>

<div class="field">
	<label for={id}>{label}</label>
	<input type="hidden" {name} {value} />
	<input
		{id}
		type="file"
		accept={PROOF_MIME.join(',')}
		class="input"
		onchange={upload}
		disabled={uploading}
		aria-describedby="{id}-hint"
		aria-invalid={shown ? 'true' : undefined}
	/>
	<p id="{id}-hint" class="field__hint" aria-live="polite">
		{uploading ? 'Mengunggah…' : value && filename ? `Terunggah: ${filename}` : hint}
	</p>
	{#if shown}<p class="field__error">{shown}</p>{/if}
</div>
