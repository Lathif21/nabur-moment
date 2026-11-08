<script lang="ts">
	import { enhance } from '$app/forms';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import ExpenseCategories from '#lib/components/finance/ExpenseCategories.svelte';
	import { phoneDisplay } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const s = $derived(data.settings);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	const err = (name: string) =>
		errors[name]
			? { 'aria-invalid': 'true' as const, 'aria-describedby': `${name}-error` }
			: { 'aria-invalid': undefined, 'aria-describedby': undefined };
</script>

{#snippet error(name: string)}
	{#if errors[name]}<p id="{name}-error" class="field__error">{errors[name]}</p>{/if}
{/snippet}

<div class="page-body max-w-3xl">
	<PageHeader
		title="Bisnis & Keuangan"
		description="Profil di invoice dan kwitansi, dan rekening BCA untuk transfer."
	/>

	{#if !data.bankReady}
		<p
			class="flex items-start gap-2 rounded-card bg-warning-bg px-4 py-3 text-body text-warning"
			role="status"
		>
			<TriangleAlert size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
			Nomor rekening dan nama pemilik rekening belum diisi. Invoice belum bisa menunjukkan ke mana klien
			mentransfer.
		</p>
	{/if}

	<form
		method="post"
		action="?/save"
		class="flex flex-col gap-6"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					errors = (result.data?.fields ?? {}) as Record<string, string>;
					toast.error('Periksa lagi isian yang ditandai merah.');
					return;
				}
				if (result.type !== 'success') return;
				errors = {};
				await update({ reset: false });
				toast.success(String(result.data?.done));
			};
		}}
	>
		<fieldset class="card flex flex-col gap-4 p-4 sm:p-5" disabled={!data.canEdit}>
			<legend class="px-1 font-display text-section-title">Profil usaha</legend>
			<p class="text-small text-ink-2">
				Dicetak di kop dan kaki invoice / kwitansi. Logo di PDF memakai wordmark Nabur Moment.
			</p>
			<div class="field">
				<label for="biz-name"
					>Nama usaha <span class="text-danger" aria-hidden="true">*</span></label
				>
				<input
					id="biz-name"
					name="businessName"
					class="input"
					maxlength="120"
					defaultValue={s.businessName}
					{...err('businessName')}
				/>
				{@render error('businessName')}
			</div>
			<div class="field">
				<label for="biz-address">Alamat</label>
				<textarea
					id="biz-address"
					name="address"
					class="input min-h-16"
					maxlength="300"
					defaultValue={s.address ?? ''}></textarea>
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<div class="field">
					<label for="biz-phone">WhatsApp</label>
					<input
						id="biz-phone"
						name="phone"
						class="input"
						inputmode="tel"
						placeholder="0812…"
						defaultValue={s.phone ? phoneDisplay(s.phone) : ''}
						{...err('phone')}
					/>
					{@render error('phone')}
				</div>
				<div class="field">
					<label for="biz-email">Email</label>
					<input
						id="biz-email"
						name="email"
						type="email"
						class="input"
						defaultValue={s.email ?? ''}
						{...err('email')}
					/>
					{@render error('email')}
				</div>
				<div class="field">
					<label for="biz-ig">Instagram</label>
					<input
						id="biz-ig"
						name="instagram"
						class="input"
						placeholder="@naburmoment"
						defaultValue={s.instagram ? `@${s.instagram}` : ''}
						{...err('instagram')}
					/>
					{@render error('instagram')}
				</div>
			</div>
		</fieldset>

		<fieldset class="card flex flex-col gap-4 p-4 sm:p-5" disabled={!data.canEdit}>
			<legend class="px-1 font-display text-section-title">Rekening untuk invoice</legend>
			<p class="text-small text-ink-2">
				Hanya rekening ini yang tercetak di invoice. Pembayaran tetap bisa dicatat dengan metode apa
				pun (tunai, e-wallet, bank lain).
			</p>
			<div class="grid gap-4 sm:grid-cols-[6rem_1fr_1fr]">
				<div class="field">
					<span class="text-small font-semibold">Bank</span>
					<p class="input flex items-center bg-sage-20">{s.bankName}</p>
				</div>
				<div class="field">
					<label for="biz-bank-number">Nomor rekening</label>
					<input
						id="biz-bank-number"
						name="bankNumber"
						class="input"
						inputmode="numeric"
						defaultValue={s.bankNumber ?? ''}
						{...err('bankNumber')}
					/>
					{@render error('bankNumber')}
				</div>
				<div class="field">
					<label for="biz-bank-holder">Atas nama</label>
					<input
						id="biz-bank-holder"
						name="bankHolder"
						class="input"
						maxlength="100"
						defaultValue={s.bankHolder ?? ''}
					/>
				</div>
			</div>
		</fieldset>

		{#if data.canEdit}
			<div class="flex justify-end">
				<button type="submit" class="btn btn--primary" disabled={busy}>
					{busy ? 'Menyimpan…' : 'Simpan'}
				</button>
			</div>
		{/if}
	</form>

	<ExpenseCategories
		categories={data.categories}
		canCreate={data.canCreate}
		canEdit={data.canEdit}
		canDelete={data.canDelete}
	/>
</div>
