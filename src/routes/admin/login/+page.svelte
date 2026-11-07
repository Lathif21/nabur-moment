<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '#lib/components/form/Field.svelte';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Masuk · Nabur Moment</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- docs/03-SCREENS.md B1: logo, email, password, Masuk. No sign-up, no "lupa password".
     The hero image comes from the CMS once it exists (Phase 1); until then a forest panel. -->
<div class="grid min-h-dvh bg-cream lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
	<main class="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
		<Wordmark tone="forest" size="sm" />

		<div class="flex flex-1 items-center py-10">
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

				<Field label="Kata sandi" name="password">
					{#snippet children(attrs)}
						<input
							{...attrs}
							class="input"
							type="password"
							autocomplete="current-password"
							required
							aria-invalid={form?.message ? 'true' : undefined}
						/>
					{/snippet}
				</Field>

				<button type="submit" class="btn btn--primary w-full" disabled={pending}>
					{pending ? 'Memproses…' : 'Masuk'}
				</button>
			</form>
		</div>

		<p class="text-small text-ink-2">© Nabur Moment</p>
	</main>

	<aside
		class="relative hidden flex-col items-center justify-center gap-6 overflow-hidden bg-forest p-12 text-cream lg:flex"
		aria-hidden="true"
	>
		<p class="font-script text-script leading-none">Cerita kita</p>
		<p class="max-w-[28ch] text-center font-display text-h2 italic">
			Momen yang tak terulang, tersimpan rapi.
		</p>
	</aside>
</div>
