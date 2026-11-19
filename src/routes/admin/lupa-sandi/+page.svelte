<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import AuthShell from '#lib/components/admin/AuthShell.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Lupa kata sandi · Nabur Moment</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AuthShell>
	{#if form?.sent}
		<div class="flex w-full max-w-sm flex-col gap-5" role="status">
			<MailCheck size={40} class="text-olive" aria-hidden="true" />
			<div class="flex flex-col gap-2">
				<h1 class="font-display text-page-title">Cek email Anda</h1>
				<p class="text-body text-ink-2">
					Jika <strong class="text-ink">{form.email}</strong> terdaftar sebagai akun admin, kami sudah
					mengirim tautan untuk membuat kata sandi baru. Tautan berlaku 1 jam. Periksa juga folder spam.
				</p>
			</div>
			<a href={resolve('admin/login')} class="btn btn--primary w-full">Kembali ke halaman masuk</a>
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
				<h1 class="font-display text-page-title">Lupa kata sandi</h1>
				<p class="text-body text-ink-2">
					Masukkan email akun admin Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.
				</p>
			</div>

			{#if form?.message}
				<p
					role="alert"
					class="rounded-card bg-danger-bg px-3.5 py-2.5 text-small font-semibold text-danger"
				>
					{form.message}
				</p>
			{/if}

			<Field label="Email" name="email">
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						type="email"
						autocomplete="username"
						required
						defaultValue={form?.email ?? ''}
					/>
				{/snippet}
			</Field>

			<button type="submit" class="btn btn--primary w-full" disabled={pending}>
				{pending ? 'Mengirim…' : 'Kirim tautan'}
			</button>
			<a href={resolve('admin/login')} class="self-center text-small font-semibold text-olive">
				Kembali ke halaman masuk
			</a>
		</form>
	{/if}
</AuthShell>
