<script lang="ts" module>
	// Scalloped seal: 24 rounded points between radius 43 and 48 around (50, 48)
	const POINTS = 24;
	const seal = (() => {
		const at = (i: number, r: number) => {
			const a = (i / (POINTS * 2)) * Math.PI * 2 - Math.PI / 2;
			return `${(50 + r * Math.cos(a)).toFixed(2)} ${(48 + r * Math.sin(a)).toFixed(2)}`;
		};
		let d = `M${at(0, 48)}`;
		for (let i = 1; i <= POINTS * 2; i++) {
			// Outer points as quadratic curves through the inner radius: soft scallops, not spikes
			d += i % 2 ? ` Q${at(i - 0.5, 48)} ${at(i, 43)}` : ` Q${at(i - 0.5, 43)} ${at(i, 48)}`;
		}
		return d + 'Z';
	})();
</script>

<script lang="ts">
	type Props = {
		/** Whole percent saved; the badge is not shown below 1 */
		percent: number;
		/** CMS text above the percent ("Hemat"); hidden when empty */
		label: string;
		/** On the featured (forest) card: lighter ribbons and a cream edge */
		inverse?: boolean;
	};

	let { percent, label, inverse = false }: Props = $props();
</script>

<!-- Rosette medal for a package promo: olive seal, cream ring, forest (or sage) ribbons.
     The shape is decorative; the text inside is real text for screen readers. -->
<div class="pointer-events-none absolute -top-3 right-5 w-22 select-none">
	<svg viewBox="0 0 100 130" class="block w-full" aria-hidden="true">
		<g class={inverse ? 'fill-sage' : 'fill-forest'}>
			<polygon points="34,62 52,70 38,126 30,113 19,121" />
			<polygon points="66,62 48,70 62,126 70,113 81,121" />
		</g>
		<path
			d={seal}
			class={['fill-olive', inverse ? 'stroke-cream' : 'stroke-none']}
			stroke-width="1.5"
		/>
		<circle cx="50" cy="48" r="35" class="fill-none stroke-cream" stroke-width="1.25" />
		<circle
			cx="50"
			cy="48"
			r="32"
			class="fill-none stroke-cream opacity-60"
			stroke-width="0.6"
			stroke-dasharray="1.5 2"
		/>
	</svg>
	<p
		class="absolute inset-x-0 top-0 flex aspect-square flex-col items-center justify-center text-cream"
		style:height="73.85%"
	>
		{#if label}
			<span class="text-[0.625rem] leading-none font-semibold tracking-[0.14em] uppercase"
				>{label}</span
			>
		{/if}
		<span class="font-display text-[1.375rem] leading-tight font-bold lining-nums">{percent}%</span>
	</p>
</div>
