<script lang="ts">
	// "Buat invoice" for an installment (P3-02). Posts to the hosting page's `?/invoice` action; the
	// amount is what is not billed yet, so only dates and notes are asked. For the DP, while nothing
	// is paid or billed, `choice` offers the whole price at once ("Lunas sekaligus").
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Modal from '#lib/components/admin/Modal.svelte';
	import { INSTALLMENT_LABEL, suggestedDueDate, type InstallmentKind } from '#lib/finance.ts';
	import { dayKeyWib, rupiah } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	type Installment = {
		id: string;
		kind: InstallmentKind;
		/** not on an active invoice yet: what this invoice bills */
		unbilled: number;
		dueDate: string | null;
	};

	type Props = {
		open: boolean;
		installment: Installment | null;
		/** Booking title, shown under the heading */
		bookingTitle: string;
		/** DP row that can still switch: the DP and the whole-price amounts */
		choice?: { dp: number; full: number } | null;
	};

	let { open = $bindable(), installment, bookingTitle, choice = null }: Props = $props();

	let billAs = $state<'dp' | 'full'>('dp');
	const amount = $derived(
		choice ? (billAs === 'full' ? choice.full : choice.dp) : (installment?.unbilled ?? 0)
	);
	/** The kind the invoice is for, after the choice */
	const kind = $derived<InstallmentKind>(choice ? billAs : (installment?.kind ?? 'dp'));

	let issueDate = $state(dayKeyWib());
	let dueDate = $state('');
	let dueTouched = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	// Fresh defaults each time it opens. Only `open` and `installment` are tracked: editing the dates never resets the form
	$effect(() => {
		if (!open || !installment) return;
		const inst = installment;
		untrack(() => {
			billAs = inst.kind === 'full' ? 'full' : 'dp';
			issueDate = dayKeyWib();
			dueDate = suggestedDueDate(inst.kind, inst.dueDate, issueDate);
			dueTouched = false;
			errors = {};
		});
	});

	function onIssueChange() {
		if (!dueTouched && installment && issueDate)
			dueDate = suggestedDueDate(installment.kind, installment.dueDate, issueDate);
	}
</script>

<Modal
	bind:open
	title="Buat invoice {installment ? INSTALLMENT_LABEL[kind] : ''}"
	description={bookingTitle}
>
	{#if installment}
		<form
			id="installment-invoice-form"
			method="post"
			action="?/invoice"
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
			<input type="hidden" name="installmentId" value={installment.id} />
			{#if choice}
				<fieldset class="field">
					<legend>Yang ditagih</legend>
					<div class="flex flex-col gap-2">
						<label class="flex items-center gap-2 text-body">
							<input type="radio" name="billAs" value="dp" bind:group={billAs} />
							{INSTALLMENT_LABEL.dp} ({rupiah(choice.dp)}), pelunasan di Hari H
						</label>
						<label class="flex items-center gap-2 text-body">
							<input type="radio" name="billAs" value="full" bind:group={billAs} />
							{INSTALLMENT_LABEL.full} ({rupiah(choice.full)}), tanpa pelunasan
						</label>
					</div>
				</fieldset>
			{/if}
			<p class="flex justify-between gap-3 rounded-card bg-sage-20 px-3 py-2 text-body">
				<span>Jumlah ditagih</span>
				<strong class="tabular-nums">{rupiah(amount)}</strong>
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="field">
					<label for="inv-issue">Tanggal invoice</label>
					<input
						id="inv-issue"
						name="issueDate"
						type="date"
						class="input"
						bind:value={issueDate}
						onchange={onIssueChange}
						aria-invalid={errors.issueDate ? 'true' : undefined}
					/>
					{#if errors.issueDate}<p class="field__error">{errors.issueDate}</p>{/if}
				</div>
				<div class="field">
					<label for="inv-due">Jatuh tempo</label>
					<input
						id="inv-due"
						name="dueDate"
						type="date"
						class="input"
						bind:value={dueDate}
						oninput={() => (dueTouched = true)}
						aria-invalid={errors.dueDate ? 'true' : undefined}
						aria-describedby="inv-due-hint"
					/>
					<p id="inv-due-hint" class="field__hint">
						{kind === 'pelunasan' ? 'Default: Hari H.' : 'Default: 7 hari.'}
					</p>
					{#if errors.dueDate}<p class="field__error">{errors.dueDate}</p>{/if}
				</div>
			</div>
			<div class="field">
				<label for="inv-notes">Catatan di invoice (opsional)</label>
				<textarea id="inv-notes" name="notes" class="input min-h-16" maxlength="1000"></textarea>
			</div>
			{#if errors.installmentId}<p class="field__error">{errors.installmentId}</p>{/if}
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="submit" form="installment-invoice-form" class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : 'Buat invoice'}
		</button>
	{/snippet}
</Modal>
