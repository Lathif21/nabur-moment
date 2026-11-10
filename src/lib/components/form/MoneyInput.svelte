<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value' | 'type'> & {
		/** Whole Rupiah; null = empty */
		value: number | null;
		/** Name of the hidden field that posts the plain number */
		name: string;
	};

	let { value = $bindable(), name, id, oninput: onInputProp, ...rest }: Props = $props();

	const grouping = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
	const show = (v: number | null) => (v === null || v === undefined ? '' : grouping.format(v));

	let text = $state('');
	// Follow outside changes (form reset / edit) without fighting the person typing
	$effect(() => {
		const formatted = show(value);
		if (digits(text) !== (value === null ? '' : String(value))) text = formatted;
	});

	function digits(s: string) {
		return s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
	}

	function oninput(e: Event & { currentTarget: HTMLInputElement }) {
		const d = digits(e.currentTarget.value).slice(0, 15);
		value = d === '' ? null : Number(d);
		text = show(value);
		// The caller's handler runs after `value` is updated (e.g. the booking drawer recomputes
		// package + add-ons into the agreed price, which the DP is 50% of)
		onInputProp?.(e);
	}
</script>

<!-- Rupiah input: "Rp" prefix, dot thousands while typing, posts whole Rupiah in a hidden field -->
<div
	class="flex min-h-10 items-center gap-2 rounded-card border border-line bg-surface px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-olive has-aria-invalid:border-danger"
>
	<span class="text-body font-semibold text-ink-2" aria-hidden="true">Rp</span>
	<input
		{...rest}
		{id}
		type="text"
		inputmode="numeric"
		autocomplete="off"
		value={text}
		{oninput}
		class="min-w-0 flex-1 border-0 bg-transparent p-0 text-body font-semibold text-ink tabular-nums outline-none focus-visible:shadow-none focus-visible:outline-none"
	/>
	<input type="hidden" {name} value={value ?? ''} />
</div>
