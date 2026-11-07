<script lang="ts">
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import TrendingDown from '@lucide/svelte/icons/trending-down';

	type Delta = {
		/** Percentage change vs the previous period, e.g. 35 or -12 */
		pct: number;
		/** Whether "up" is good (income, profit) or bad (expenses) */
		upIsGood: boolean;
	};

	type Props = {
		label: string;
		/** Already formatted with rupiahShort() */
		value: string;
		delta?: Delta;
		/** Neutral note instead of a delta, e.g. "3 invoice terbuka" */
		note?: string;
		/** `dark` = the one profit tile per row (forest) */
		variant?: 'default' | 'dark';
	};

	let { label, value, delta, note, variant = 'default' }: Props = $props();

	const up = $derived(delta ? delta.pct >= 0 : false);
	const good = $derived(delta ? (up ? delta.upIsGood : !delta.upIsGood) : false);
</script>

<div
	class={[
		'@container flex flex-col gap-1.5 rounded-card border p-4',
		variant === 'dark' ? 'border-forest bg-forest text-cream' : 'border-line bg-surface'
	]}
>
	<span class={['text-small font-semibold', variant === 'dark' ? 'text-cream' : 'text-ink-2']}
		>{label}</span
	>
	<span class="font-display text-[1.625rem] leading-tight lining-nums tabular-nums">{value}</span>
	{#if delta}
		<span
			class={[
				'chip w-fit',
				variant === 'dark' ? 'bg-cream/15 text-cream' : good ? 'chip--success' : 'chip--danger'
			]}
		>
			{#if up}<TrendingUp size={14} aria-hidden="true" />{:else}<TrendingDown
					size={14}
					aria-hidden="true"
				/>{/if}
			<span class="sr-only">{up ? 'Naik' : 'Turun'}</span>
			{Math.abs(Math.round(delta.pct))}%<span class="@max-[14rem]:sr-only"
				>vs periode sebelumnya</span
			>
		</span>
	{:else if note}
		<span class={['text-small', variant === 'dark' ? 'text-cream' : 'text-ink-2']}>{note}</span>
	{/if}
</div>
