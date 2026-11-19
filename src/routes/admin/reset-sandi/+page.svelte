<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthShell from '#lib/components/admin/AuthShell.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import PasswordInput from '#lib/components/form/PasswordInput.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
	const errors: Record<string, string | undefined> = $derived(
		(form && 'errors' in form && form.errors) || {}
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
</script>

<svelte:head>
	<title>Buat kata sandi baru · Nabur Moment</title>
	<meta name="robots" content="noindex, nofollow" />
	<!-- The token is in the URL: never send it to another site -->
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<AuthShell>
	{#if !data.valid}
		<div class="flex w-full max-w-sm flex-col gap-5">
			<div class="flex flex-col gap-2">
				<h1 class="font-display text-page-title">Tautan tidak berlaku</h1>
				<p class="text-body text-ink-2">
					Tautan ini tidak valid, sudah dipakai, atau sudah lewat 1 jam. Minta tautan baru untuk
					mengatur ulang kata sandi.
				</p>
			</div>
			<a href={resolve('admin/lupa-sandi')} class="btn btn--primary w-full">Minta tautan baru</a>
			<a href={resolve('admin/login')} class="self-center text-small font-semibold text-olive">
				Kembali ke halaman masuk
			</a>
		</div>
	{:else}
		<form
			method="post"
			class="flex w-full max-w-sm flex-col gap-5"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					await update({ reset: false });
					pending = false;
				};
			}}
		>
			<div class="flex flex-col gap-2">
				<h1 class="font-display text-page-title">Buat kata sandi baru</h1>
				<p class="text-body text-ink-2">
					Minimal 8 karakter. Setelah disimpan, Anda keluar dari semua perangkat lalu masuk lagi
					dengan kata sandi baru.
				</p>
			</div>

			{#if message}
				<p
					role="alert"
					class="rounded-card bg-danger-bg px-3.5 py-2.5 text-small font-semibold text-danger"
				>
					{message}
				</p>
			{/if}

			<input type="hidden" name="token" value={data.token} />

			<Field
				label="Kata sandi baru"
				name="password"
				errors={errors.password ? [errors.password] : undefined}
			>
				{#snippet children(attrs)}
					<PasswordInput {...attrs} autocomplete="new-password" required minlength={8} />
				{/snippet}
			</Field>

			<Field
				label="Ulangi kata sandi baru"
				name="confirm"
				errors={errors.confirm ? [errors.confirm] : undefined}
			>
				{#snippet children(attrs)}
					<PasswordInput {...attrs} autocomplete="new-password" required />
				{/snippet}
			</Field>

			<button type="submit" class="btn btn--primary w-full" disabled={pending}>
				{pending ? 'Menyimpan…' : 'Simpan kata sandi'}
			</button>
		</form>
	{/if}
</AuthShell>
