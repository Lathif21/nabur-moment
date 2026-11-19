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
		hint = 'Foto atau JPG / PNG / WebP, maks. 10 MB. Disimpan privat.'
	}: Props = $props();

	let filename = $state('');
	let localError = $state('');
	const shown = $derived(localError || error || '');

	// iPad / iPhone photos are HEIC. Accepting HEIC means the Photo Library hands over the original
	// instead of transcoding it (which can fail silently, e.g. for photos kept in iCloud); the
	// browser then converts it to JPEG. Big photos are scaled down the same way.
	const ACCEPT = [...PROOF_MIME, 'image/heic', 'image/heif'].join(',');
	const MAX_EDGE = 2400;
	const CONVERT_ABOVE = 2 * 1024 * 1024;

	async function toJpeg(file: File): Promise<File> {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		try {
			const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(bitmap.width * scale);
			canvas.height = Math.round(bitmap.height * scale);
			canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
			const blob = await new Promise<Blob | null>((done) =>
				canvas.toBlob(done, 'image/jpeg', 0.85)
			);
			if (!blob) throw new Error('encode');
			return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.jpg`, {
				type: 'image/jpeg'
			});
		} finally {
			bitmap.close();
		}
	}

	/** A JPG / PNG / WebP within the limit, converting HEIC and big photos; null = not usable */
	async function prepare(file: File): Promise<File | null> {
		const allowed = (PROOF_MIME as readonly string[]).includes(file.type);
		if (allowed && file.size <= CONVERT_ABOVE) return file;
		try {
			return await toJpeg(file);
		} catch {
			return allowed && file.size <= PROOF_MAX_BYTES ? file : null;
		}
	}

	/** The File being handled: `input` and `change` both fire for one pick */
	let picked: File | null = null;

	async function upload(e: Event & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget;
		const original = input.files?.[0];
		if (original && original === picked) return;
		localError = '';
		if (!original) {
			// iPadOS sometimes returns nothing from the Photo Library; never fail silently
			if (!picked)
				localError = 'Foto tidak terbaca. Coba lagi, atau pakai Ambil Foto / Pilih File.';
			return;
		}
		picked = original;
		uploading = true;
		try {
			const file = await prepare(original);
			if (!file) {
				localError = 'File harus berupa gambar JPG, PNG, WebP, atau foto dari iPhone / iPad.';
				return;
			}
			if (file.size > PROOF_MAX_BYTES) {
				localError = 'Ukuran file maksimal 10 MB.';
				return;
			}
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
			filename = original.name;
		} catch (err) {
			localError =
				err instanceof Error && err.message ? err.message : 'File gagal diunggah. Coba lagi.';
		} finally {
			uploading = false;
			picked = null;
			// So picking the same photo again fires again
			input.value = '';
		}
	}
</script>

<div class="field">
	<label for={id}>{label}</label>
	<input type="hidden" {name} {value} />
	<input
		{id}
		type="file"
		accept={ACCEPT}
		class="input"
		oninput={upload}
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
