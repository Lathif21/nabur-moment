<script lang="ts">
	// Pengeluaran form (P3-05): date, amount, category, booking (empty = overhead), description,
	// method, receipt photo (private bucket). New or edit; posts to the hosting page's `?/expense`.
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import { PAYMENT_METHOD_LABEL } from '#lib/finance.ts';
	import { dayKeyWib } from '#lib/format.ts';
	import { PAYMENT_METHODS } from '#lib/schemas/finance.ts';
	import { toast } from '#lib/toast.ts';
	import PrivateImageUpload from './PrivateImageUpload.svelte';

	type Editing = {
		id: string;
		spentOn: string;
		amount: number;
		categoryId: string;
		bookingId: string | null;
		description: string | null;
		method: (typeof PAYMENT_METHODS)[number];
		receiptMediaId: string | null;
	};

	type Props = {
		open: boolean;
		/** null = new expense */
		expense: Editing | null;
		categories: { id: string; name: string; archived: boolean }[];
		/** Bookings to pick from; leave out on the booking page (`bookingId` fixed) */
		bookings?: { id: string; title: string; clientName: string }[];
		/** The booking page's booking */
		bookingId?: string | null;
	};

	let { open = $bindable(), expense, categories, bookings, bookingId = null }: Props = $props();

	let spentOn = $state(dayKeyWib());
	let amount = $state<number | null>(null);
	let categoryId = $state('');
	let booking = $state('');
	let description = $state('');
	let method = $state<(typeof PAYMENT_METHODS)[number]>('transfer');
	let receipt = $state('');
	let uploading = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	// Fresh form each time it opens; only `open` is tracked
	$effect(() => {
		if (!open) return;
		untrack(() => {
			const e = expense;
			spentOn = e?.spentOn ?? dayKeyWib();
			amount = e?.amount ?? null;
			categoryId = e?.categoryId ?? '';
			booking = e ? (e.bookingId ?? '') : (bookingId ?? '');
			description = e?.description ?? '';
			method = e?.method ?? 'transfer';
			receipt = e?.receiptMediaId ?? '';
			errors = {};
		});
	});

	/** Active categories, plus the current one when it was archived since */
	const options = $derived(categories.filter((c) => !c.archived || c.id === expense?.categoryId));
</script>

<Drawer
	bind:open
	title={expense ? 'Ubah pengeluaran' : 'Catat pengeluaran'}
	description="Dengan booking = biaya langsung; tanpa booking = overhead."
>
	<form
		id="expense-form"
		method="post"
		action="?/expense"
		class="flex flex-col gap-4"
		novalidate
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'failure') {
					errors = (result.data?.fields ?? {}) as Record<string, string>;
					toast.error(String(result.data?.error ?? 'Periksa lagi isian yang ditandai merah.'));
					return;
				}
				if (result.type !== 'success') return;
				await update({ reset: false });
				open = false;
				toast.success(String(result.data?.done));
			};
		}}
	>
		{#if expense}<input type="hidden" name="id" value={expense.id} />{/if}

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="field">
				<label for="exp-amount">Jumlah</label>
				<MoneyInput
					id="exp-amount"
					name="amount"
					bind:value={amount}
					aria-invalid={errors.amount ? 'true' : undefined}
				/>
				{#if errors.amount}<p class="field__error">{errors.amount}</p>{/if}
			</div>
			<div class="field">
				<label for="exp-date">Tanggal</label>
				<input
					id="exp-date"
					name="spentOn"
					type="date"
					class="input"
					bind:value={spentOn}
					aria-invalid={errors.spentOn ? 'true' : undefined}
				/>
				{#if errors.spentOn}<p class="field__error">{errors.spentOn}</p>{/if}
			</div>
		</div>

		<div class="field">
			<label for="exp-category">Kategori</label>
			<select
				id="exp-category"
				name="categoryId"
				class="input"
				bind:value={categoryId}
				aria-invalid={errors.categoryId ? 'true' : undefined}
			>
				<option value="">Pilih kategori…</option>
				{#each options as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
			</select>
			{#if errors.categoryId}<p class="field__error">{errors.categoryId}</p>{/if}
		</div>

		{#if bookings}
			<div class="field">
				<label for="exp-booking">Booking</label>
				<select
					id="exp-booking"
					name="bookingId"
					class="input"
					bind:value={booking}
					aria-describedby="exp-booking-hint"
				>
					<option value="">Overhead (tanpa booking)</option>
					{#each bookings as b (b.id)}
						<option value={b.id}>{b.title} · {b.clientName}</option>
					{/each}
				</select>
				<p id="exp-booking-hint" class="field__hint">
					Biaya iklan, langganan aplikasi, dan sejenisnya: biarkan Overhead.
				</p>
				{#if errors.bookingId}<p class="field__error">{errors.bookingId}</p>{/if}
			</div>
		{:else}
			<input type="hidden" name="bookingId" value={booking} />
		{/if}

		<div class="field">
			<label for="exp-desc">Keterangan</label>
			<input
				id="exp-desc"
				name="description"
				class="input"
				maxlength="500"
				placeholder="Mis. fee second shooter, bensin ke venue"
				bind:value={description}
			/>
		</div>

		<div class="field">
			<label for="exp-method">Metode</label>
			<select id="exp-method" name="method" class="input" bind:value={method}>
				{#each PAYMENT_METHODS as m (m)}<option value={m}>{PAYMENT_METHOD_LABEL[m]}</option>{/each}
			</select>
		</div>

		<PrivateImageUpload
			id="exp-receipt"
			label="Foto nota (opsional)"
			name="receiptMediaId"
			endpoint="/admin/api/expense-receipts"
			bind:value={receipt}
			bind:uploading
			error={errors.receiptMediaId}
			hint={expense?.receiptMediaId && receipt === expense.receiptMediaId
				? 'Nota sudah ada. Pilih file lain untuk menggantinya.'
				: 'JPG / PNG / WebP, maks. 10 MB. Disimpan privat.'}
		/>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="submit" form="expense-form" class="btn btn--primary" disabled={busy || uploading}>
			{busy ? 'Menyimpan…' : 'Simpan'}
		</button>
	{/snippet}
</Drawer>
