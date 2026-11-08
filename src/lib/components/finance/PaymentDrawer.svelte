<script lang="ts">
	// "Catat pembayaran" (P3-04): booking → invoice or installment → amount (capped server-side at
	// what is open), date, method, optional proof image (uploaded straight to the private bucket).
	// Posts to the hosting page's `?/payment`.
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import PrivateImageUpload from './PrivateImageUpload.svelte';
	import { PAYMENT_METHOD_LABEL } from '#lib/finance.ts';
	import { dayKeyWib, rupiah } from '#lib/format.ts';
	import { PAYMENT_METHODS } from '#lib/schemas/finance.ts';
	import { toast } from '#lib/toast.ts';

	type Target = { value: string; label: string; open: number };
	type BookingOption = { id: string; title: string; clientName: string };

	type Props = {
		open: boolean;
		/** Bookings to pick from; leave out when `bookingId` is fixed (booking page) */
		bookings?: BookingOption[];
		/** Preselected (list page `?booking=`) or fixed booking */
		bookingId?: string | null;
		/** After a successful save, e.g. to offer the move to Booked */
		onsaved?: (r: { dpPaid: boolean; bookingId: string }) => void;
	};

	let { open = $bindable(), bookings, bookingId = null, onsaved }: Props = $props();

	let selected = $state('');
	let targets = $state<Target[]>([]);
	let loadingTargets = $state(false);
	let target = $state('');
	let amount = $state<number | null>(null);
	let paidOn = $state(dayKeyWib());
	let method = $state<(typeof PAYMENT_METHODS)[number]>('transfer');
	let proofId = $state('');
	let uploading = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	// Fresh form each time it opens; only `open` is tracked, so nothing reloads while typing
	$effect(() => {
		if (!open) return;
		untrack(() => {
			selected = bookingId ?? '';
			paidOn = dayKeyWib();
			method = 'transfer';
			proofId = '';
			errors = {};
			void loadTargets(selected);
		});
	});

	async function loadTargets(id: string) {
		targets = [];
		target = '';
		amount = null;
		if (!id) return;
		loadingTargets = true;
		try {
			const res = await fetch(`/admin/api/bookings/${id}/payment-targets`);
			targets = res.ok ? ((await res.json()) as Target[]) : [];
		} finally {
			loadingTargets = false;
		}
		if (targets[0]) pickTarget(targets[0].value);
	}

	function pickTarget(value: string) {
		target = value;
		amount = targets.find((t) => t.value === value)?.open ?? null;
	}

	const current = $derived(targets.find((t) => t.value === target));
</script>

<Drawer bind:open title="Catat pembayaran" description="Kwitansi dibuat otomatis.">
	<form
		id="payment-form"
		method="post"
		action="?/payment"
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
				onsaved?.({
					dpPaid: !!result.data?.dpPaid,
					bookingId: String(result.data?.bookingId ?? '')
				});
			};
		}}
	>
		{#if bookings}
			<div class="field">
				<label for="pay-booking">Booking</label>
				<select
					id="pay-booking"
					name="bookingId"
					class="input"
					bind:value={selected}
					onchange={() => loadTargets(selected)}
					aria-invalid={errors.bookingId ? 'true' : undefined}
				>
					<option value="">Pilih booking…</option>
					{#each bookings as b (b.id)}
						<option value={b.id}>{b.title} · {b.clientName}</option>
					{/each}
				</select>
				{#if errors.bookingId}<p class="field__error">{errors.bookingId}</p>{/if}
			</div>
		{:else}
			<input type="hidden" name="bookingId" value={selected} />
		{/if}

		<div class="field">
			<label for="pay-target">Untuk</label>
			<select
				id="pay-target"
				name="target"
				class="input"
				value={target}
				onchange={(e) => pickTarget(e.currentTarget.value)}
				disabled={loadingTargets || !targets.length}
				aria-invalid={errors.target ? 'true' : undefined}
				aria-describedby="pay-target-hint"
			>
				{#if !targets.length}<option value=""
						>{loadingTargets
							? 'Memuat…'
							: selected
								? 'Tidak ada tagihan terbuka'
								: 'Pilih booking dulu'}</option
					>{/if}
				{#each targets as t (t.value)}
					<option value={t.value}>{t.label} · sisa {rupiah(t.open)}</option>
				{/each}
			</select>
			<p id="pay-target-hint" class="field__hint">
				Invoice yang masih terbuka, atau termin DP / pelunasan yang belum punya invoice.
			</p>
			{#if errors.target}<p class="field__error">{errors.target}</p>{/if}
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="field">
				<label for="pay-amount">Jumlah</label>
				<MoneyInput
					id="pay-amount"
					name="amount"
					bind:value={amount}
					aria-invalid={errors.amount ? 'true' : undefined}
				/>
				{#if current && amount !== null && amount < current.open}<p class="field__hint">
						Sebagian: sisa {rupiah(current.open - amount)} setelah ini.
					</p>{/if}
				{#if errors.amount}<p class="field__error">{errors.amount}</p>{/if}
			</div>
			<div class="field">
				<label for="pay-date">Tanggal bayar</label>
				<input
					id="pay-date"
					name="paidOn"
					type="date"
					class="input"
					bind:value={paidOn}
					aria-invalid={errors.paidOn ? 'true' : undefined}
				/>
				{#if errors.paidOn}<p class="field__error">{errors.paidOn}</p>{/if}
			</div>
		</div>

		<div class="field">
			<label for="pay-method">Metode</label>
			<select id="pay-method" name="method" class="input" bind:value={method}>
				{#each PAYMENT_METHODS as m (m)}<option value={m}>{PAYMENT_METHOD_LABEL[m]}</option>{/each}
			</select>
		</div>

		<PrivateImageUpload
			id="pay-proof"
			label="Bukti pembayaran (opsional)"
			name="proofMediaId"
			endpoint="/admin/api/payment-proofs"
			bind:value={proofId}
			bind:uploading
			error={errors.proofMediaId}
			hint="Tangkapan layar transfer, JPG / PNG / WebP, maks. 10 MB. Disimpan privat."
		/>

		<div class="field">
			<label for="pay-note">Catatan (opsional)</label>
			<textarea id="pay-note" name="note" class="input min-h-16" maxlength="1000"></textarea>
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button
			type="submit"
			form="payment-form"
			class="btn btn--primary"
			disabled={busy || uploading || !target}
		>
			{busy ? 'Menyimpan…' : 'Simpan pembayaran'}
		</button>
	{/snippet}
</Drawer>
