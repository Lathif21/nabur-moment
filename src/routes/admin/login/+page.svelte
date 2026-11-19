<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AuthShell from '#lib/components/admin/AuthShell.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import PasswordInput from '#lib/components/form/PasswordInput.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
	// Back from "Buat kata sandi baru"
	const wasReset = $derived(page.url.searchParams.get('reset') === '1');
</script>

<svelte:head>
	<title>Masuk · Nabur Moment</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- docs/03-SCREENS.md B1: logo, email, password (show / hide), "Lupa kata sandi?", Masuk.
     No sign-up. -->
<AuthShell>
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
			<h1 class="font-display text-page-title">Masuk</h1>
			<p class="text-body text-ink-2">Masuk ke halaman admin Nabur Moment.</p>
		</div>

		{#if form?.message}
			<p
				role="alert"
				class="rounded-card bg-danger-bg px-3.5 py-2.5 text-small font-semibold text-danger"
			>
				{form.message}
			</p>
		{:else if wasReset}
			<p
				role="status"
				class="rounded-card bg-success-bg px-3.5 py-2.5 text-small font-semibold text-success"
			>
				Kata sandi baru tersimpan. Silakan masuk.
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
					aria-invalid={form?.message ? 'true' : undefined}
				/>
			{/snippet}
		</Field>

		<div class="flex flex-col gap-1.5">
			<Field label="Kata sandi" name="password">
				{#snippet children(attrs)}
					<PasswordInput
						{...attrs}
						autocomplete="current-password"
						required
						aria-invalid={form?.message ? 'true' : undefined}
					/>
				{/snippet}
			</Field>
			<a href={resolve('admin/lupa-sandi')} class="self-end text-small font-semibold text-olive">
				Lupa kata sandi?
			</a>
		</div>

		<button type="submit" class="btn btn--primary w-full" disabled={pending}>
			{pending ? 'Memproses…' : 'Masuk'}
		</button>
	</form>
</AuthShell>
