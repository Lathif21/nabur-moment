<script lang="ts">
	// The one period filter (P3-06, 03-SCREENS B1; adapted from the Befisien CRM): Harian · Mingguan
	// · Bulanan · Tahunan · Custom, prev / next and the label. Plain links, so a refresh or a shared
	// URL keeps the period.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Popover } from 'bits-ui';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { dayKeyWib } from '#lib/format.ts';
	import {
		addDays,
		PERIOD_LABELS,
		periodParams,
		type Period,
		type ResolvedPeriod
	} from '#lib/period.ts';

	type Props = {
		/** From resolvePeriod() in the page load */
		value: ResolvedPeriod;
		/** The page's resolved path, e.g. resolve('admin') */
		base: string;
	};

	let { value, base }: Props = $props();

	const today = $derived(dayKeyWib());
	/** Switching Harian / Mingguan / … keeps today when it is in view, otherwise the period start */
	const anchor = $derived(value.from <= today && today <= value.to ? today : value.from);
	const query = (period: Period, from: string, to?: string) =>
		'?' +
		Object.entries(periodParams(period, from, to))
			.map(([k, v]) => `${k}=${v}`)
			.join('&');
	/** Prev / next: one period; a custom range moves by its own length */
	const shifted = (start: string) =>
		value.period === 'custom'
			? query('custom', start, addDays(start, value.days - 1))
			: query(value.period, start);

	let customOpen = $state(false);
	let customFrom = $state('');
	let customTo = $state('');
	$effect(() => {
		if (!customOpen) return;
		untrack(() => {
			customFrom = value.from;
			customTo = value.to;
		});
	});

	function applyCustom(e: SubmitEvent) {
		e.preventDefault();
		if (!customFrom) return;
		customOpen = false;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- `base` is resolved by the page
		goto(`${base}${query('custom', customFrom, customTo || customFrom)}`, { reset: false });
	}

	const OPTIONS: Exclude<Period, 'custom'>[] = ['day', 'week', 'month', 'year'];
	const segment = (active: boolean) => [
		'inline-flex min-h-9 items-center rounded-card px-3 text-small font-semibold',
		active ? 'bg-forest text-cream' : 'text-ink-2 hover:bg-sage-20 hover:text-ink'
	];
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- every href starts with `base`, resolved by the page -->
<div class="flex flex-wrap items-center gap-2">
	<div
		class="flex flex-wrap items-center gap-0.5 rounded-card border border-line bg-surface p-0.5"
		role="group"
		aria-label="Rentang waktu"
	>
		{#each OPTIONS as p (p)}
			<a
				class={segment(value.period === p)}
				href="{base}{query(p, anchor)}"
				aria-current={value.period === p ? 'page' : undefined}
				data-sveltekit-noscroll
				data-sveltekit-keepfocus>{PERIOD_LABELS[p]}</a
			>
		{/each}
		<Popover.Root bind:open={customOpen}>
			<Popover.Trigger
				class={segment(value.period === 'custom')}
				aria-pressed={value.period === 'custom'}
			>
				Custom
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					role="dialog"
					aria-label="Rentang tanggal custom"
					sideOffset={8}
					align="end"
					class="z-50 w-[min(320px,calc(100vw-32px))] rounded-card border border-line bg-surface p-4 shadow-modal"
				>
					<form class="flex flex-col gap-3" onsubmit={applyCustom}>
						<p class="text-small font-semibold text-ink-2">Rentang tanggal (WIB)</p>
						<div class="grid grid-cols-2 gap-3">
							<div class="field">
								<label for="period-from">Dari</label>
								<input
									id="period-from"
									class="input"
									type="date"
									bind:value={customFrom}
									required
									max={customTo || undefined}
								/>
							</div>
							<div class="field">
								<label for="period-to">Sampai</label>
								<input
									id="period-to"
									class="input"
									type="date"
									bind:value={customTo}
									min={customFrom || undefined}
								/>
							</div>
						</div>
						<button type="submit" class="btn btn--primary">Terapkan</button>
					</form>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	</div>

	<div class="flex items-center gap-1">
		<a
			class="icon-btn"
			href="{base}{shifted(value.prevAnchor)}"
			aria-label="Periode sebelumnya"
			data-sveltekit-noscroll
			data-sveltekit-keepfocus
		>
			<ChevronLeft size={16} aria-hidden="true" />
		</a>
		<span class="min-w-36 text-center text-body font-semibold" aria-live="polite"
			>{value.label}</span
		>
		{#if value.nextInFuture}
			<span
				class="icon-btn opacity-40"
				role="link"
				aria-disabled="true"
				aria-label="Periode berikutnya"
			>
				<ChevronRight size={16} aria-hidden="true" />
			</span>
		{:else}
			<a
				class="icon-btn"
				href="{base}{shifted(value.nextAnchor)}"
				aria-label="Periode berikutnya"
				data-sveltekit-noscroll
				data-sveltekit-keepfocus
			>
				<ChevronRight size={16} aria-hidden="true" />
			</a>
		{/if}
	</div>
</div>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
