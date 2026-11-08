<script lang="ts">
	// "Invoice lain" (P3-02): an invoice with free lines for one booking (extra hours, reels…).
	// No discount lines: prices are 0 or more. Posts to the hosting page's `?/customInvoice`.
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import { addDays, DP_INVOICE_DAYS, itemsTotal } from '#lib/finance.ts';
	import { dayKeyWib, rupiah } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	type Props = { open: boolean; bookingId: string; bookingTitle: string };

	let { open = $bindable(), bookingId, bookingTitle }: Props = $props();

	type Row = { key: number; description: string; qty: number; unitPrice: number | null };
	let nextKey = 0;
	const blank = (): Row => ({ key: nextKey++, description: '', qty: 1, unitPrice: null });

	let rows = $state<Row[]>([blank()]);
	let issueDate = $state(dayKeyWib());
	let dueDate = $state(addDays(dayKeyWib(), DP_INVOICE_DAYS));
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	// Only `open` is tracked: editing the dates or lines never resets the form
	$effect(() => {
		if (!open) return;
		untrack(() => {
			rows = [blank()];
			issueDate = dayKeyWib();
			dueDate = addDays(issueDate, DP_INVOICE_DAYS);
			errors = {};
		});
	});

	const clean = $derived(
		rows.map((r) => ({
			description: r.description.trim(),
			qty: Number(r.qty) || 0,
			unitPrice: r.unitPrice ?? 0
		}))
	);
	const total = $derived(itemsTotal(clean));
	const itemsJson = $derived(JSON.stringify(clean));
</script>

<Drawer bind:open title="Invoice lain" description={bookingTitle}>
	<form
		id="custom-invoice-form"
		method="post"
		action="?/customInvoice"
		class="flex flex-col gap-5"
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
		<input type="hidden" name="bookingId" value={bookingId} />
		<input type="hidden" name="items" value={itemsJson} />

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="field">
				<label for="cinv-issue">Tanggal invoice</label>
				<input
					id="cinv-issue"
					name="issueDate"
					type="date"
					class="input"
					bind:value={issueDate}
					aria-invalid={errors.issueDate ? 'true' : undefined}
				/>
				{#if errors.issueDate}<p class="field__error">{errors.issueDate}</p>{/if}
			</div>
			<div class="field">
				<label for="cinv-due">Jatuh tempo</label>
				<input
					id="cinv-due"
					name="dueDate"
					type="date"
					class="input"
					bind:value={dueDate}
					aria-invalid={errors.dueDate ? 'true' : undefined}
				/>
				{#if errors.dueDate}<p class="field__error">{errors.dueDate}</p>{/if}
			</div>
		</div>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-1 font-semibold">Baris tagihan</legend>
			{#each rows as r, i (r.key)}
				<div class="flex flex-col gap-2 rounded-card border border-line p-3">
					<div class="field">
						<label for="cinv-{r.key}-desc">Keterangan</label>
						<input
							id="cinv-{r.key}-desc"
							class="input"
							maxlength="200"
							bind:value={r.description}
							aria-invalid={errors[`items.${i}.description`] ? 'true' : undefined}
						/>
						{#if errors[`items.${i}.description`]}<p class="field__error">
								{errors[`items.${i}.description`]}
							</p>{/if}
					</div>
					<div class="grid grid-cols-[1fr_6rem_auto] items-end gap-2">
						<div class="field">
							<label for="cinv-{r.key}-price">Harga satuan</label>
							<MoneyInput
								id="cinv-{r.key}-price"
								name="_item_price_{r.key}"
								bind:value={r.unitPrice}
							/>
						</div>
						<div class="field">
							<label for="cinv-{r.key}-qty">Jumlah</label>
							<input
								id="cinv-{r.key}-qty"
								class="input"
								type="number"
								min="1"
								max="999"
								bind:value={r.qty}
							/>
						</div>
						<button
							type="button"
							class="icon-btn mb-1"
							aria-label="Hapus baris {i + 1}"
							disabled={rows.length === 1}
							onclick={() => (rows = rows.filter((x) => x.key !== r.key))}
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</div>
				</div>
			{/each}
			<button
				type="button"
				class="btn btn--secondary self-start"
				onclick={() => (rows = [...rows, blank()])}
			>
				<Plus size={16} aria-hidden="true" /> Tambah baris
			</button>
			{#if errors.items}<p class="field__error">{errors.items}</p>{/if}
		</fieldset>

		<p class="flex justify-between gap-3 border-t border-line pt-3 text-body font-semibold">
			<span>Total</span>
			<span class="tabular-nums" data-testid="custom-invoice-total">{rupiah(total)}</span>
		</p>

		<div class="field">
			<label for="cinv-notes">Catatan di invoice (opsional)</label>
			<textarea id="cinv-notes" name="notes" class="input min-h-16" maxlength="1000"></textarea>
		</div>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="submit" form="custom-invoice-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Buat invoice'}
		</button>
	{/snippet}
</Drawer>
