<script lang="ts">
	// Pemasukan vs Pengeluaran per bucket (P3-06): grouped bars on one axis, forest = income,
	// olive = expenses (06-DESIGN-SYSTEM chart series 1 / 2). Legend + hover / focus tooltip + a table
	// view, so nothing depends on colour alone (the muted brand pair fails the chroma check of the
	// dataviz validator; CVD separation ΔE 25 and contrast pass).
	import { rupiah, rupiahShort } from '#lib/format.ts';
	import { bucketLabel, bucketTitle, type Bucket } from '#lib/period.ts';

	type Point = { start: string; income: number; expenses: number };
	type Props = { points: Point[]; bucket: Bucket; label: string };

	let { points, bucket, label }: Props = $props();

	let width = $state(640);
	const HEIGHT = 220;
	const PAD = { top: 12, right: 8, bottom: 26, left: 56 };
	const plotW = $derived(Math.max(120, width - PAD.left - PAD.right));
	const plotH = HEIGHT - PAD.top - PAD.bottom;

	/** A round top for the axis: 1, 2 or 5 × 10^n */
	function niceMax(v: number) {
		if (v <= 0) return 1_000_000;
		const p = 10 ** Math.floor(Math.log10(v));
		const n = v / p;
		return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
	}
	const max = $derived(niceMax(Math.max(0, ...points.flatMap((p) => [p.income, p.expenses]))));
	const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * max));
	const y = (v: number) => PAD.top + plotH - (v / max) * plotH;

	const band = $derived(plotW / Math.max(1, points.length));
	/** Two bars per bucket with a 2px gap between them; thin, at most 28px each */
	const barW = $derived(Math.max(3, Math.min(28, (band - 2) * 0.32)));
	const x0 = (i: number) => PAD.left + i * band + band / 2 - barW - 1;

	/** Bar with 4px rounded top, square on the baseline */
	function bar(x: number, v: number) {
		const h = Math.max(0, (v / max) * plotH);
		if (h === 0) return '';
		const r = Math.min(4, barW / 2, h);
		const top = PAD.top + plotH - h;
		const base = PAD.top + plotH;
		return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + barW - r}Q${x + barW},${top} ${x + barW},${top + r}V${base}Z`;
	}

	/** Thin out the axis labels so they never collide */
	const every = $derived(
		Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 64))))
	);

	let active = $state<number | null>(null);
	const tip = $derived(active === null ? null : points[active]);
	const tipX = $derived(active === null ? 0 : PAD.left + active * band + band / 2);
</script>

<figure class="flex flex-col gap-3" aria-label={label}>
	<figcaption class="flex flex-wrap items-center gap-4 text-small text-ink-2">
		<span class="inline-flex items-center gap-1.5">
			<span class="inline-block size-3 rounded-[3px] bg-forest" aria-hidden="true"></span> Pemasukan
		</span>
		<span class="inline-flex items-center gap-1.5">
			<span class="inline-block size-3 rounded-[3px] bg-olive" aria-hidden="true"></span> Pengeluaran
		</span>
	</figcaption>

	<div class="relative" bind:clientWidth={width}>
		<svg
			width="100%"
			height={HEIGHT}
			viewBox="0 0 {width} {HEIGHT}"
			role="img"
			aria-label="{label}. Rincian per periode ada di tabel di bawah grafik."
		>
			{#each ticks as t (t)}
				<line
					x1={PAD.left}
					x2={PAD.left + plotW}
					y1={y(t)}
					y2={y(t)}
					stroke="var(--color-line)"
					stroke-width={t === 0 ? 1 : 0.5}
					stroke-dasharray={t === 0 ? undefined : '2 4'}
				/>
				<text
					x={PAD.left - 8}
					y={y(t)}
					text-anchor="end"
					dominant-baseline="middle"
					class="fill-ink-2 text-[11px] tabular-nums">{rupiahShort(t)}</text
				>
			{/each}

			{#each points as p, i (p.start)}
				<g opacity={active === null || active === i ? 1 : 0.45}>
					<path d={bar(x0(i), p.income)} fill="var(--color-forest)" />
					<path d={bar(x0(i) + barW + 2, p.expenses)} fill="var(--color-olive)" />
				</g>
				{#if i % every === 0}
					<text
						x={PAD.left + i * band + band / 2}
						y={HEIGHT - 8}
						text-anchor="middle"
						class="fill-ink-2 text-[11px]">{bucketLabel(p.start, bucket)}</text
					>
				{/if}
				<!-- Hit area larger than the bars: the whole bucket column -->
				<rect
					x={PAD.left + i * band}
					y={PAD.top}
					width={band}
					height={plotH}
					fill="transparent"
					role="presentation"
					onpointerenter={() => (active = i)}
					onpointerleave={() => (active = null)}
				/>
			{/each}
		</svg>

		{#if tip}
			<div
				class="pointer-events-none absolute top-0 z-10 w-60 rounded-card border border-line bg-surface p-2.5 text-small shadow-modal"
				style:left="{Math.min(Math.max(tipX - 120, 0), width - 240)}px"
				role="status"
			>
				<p class="font-semibold">{bucketTitle(tip.start, bucket)}</p>
				<p class="mt-1 flex justify-between gap-2">
					<span class="inline-flex items-center gap-1.5"
						><span class="inline-block size-2.5 rounded-[2px] bg-forest" aria-hidden="true"
						></span>Pemasukan</span
					><span class="whitespace-nowrap tabular-nums">{rupiah(tip.income)}</span>
				</p>
				<p class="flex justify-between gap-2">
					<span class="inline-flex items-center gap-1.5"
						><span class="inline-block size-2.5 rounded-[2px] bg-olive" aria-hidden="true"
						></span>Pengeluaran</span
					><span class="whitespace-nowrap tabular-nums">{rupiah(tip.expenses)}</span>
				</p>
				<p class="mt-1 flex justify-between gap-2 border-t border-line pt-1 font-semibold">
					<span>Selisih</span><span class="whitespace-nowrap tabular-nums"
						>{rupiah(tip.income - tip.expenses)}</span
					>
				</p>
			</div>
		{/if}
	</div>

	<details class="text-small">
		<summary class="cursor-pointer text-ink-2 hover:text-ink">Lihat sebagai tabel</summary>
		<div class="table-wrap mt-2">
			<table class="table" aria-label="{label} (tabel)">
				<thead>
					<tr>
						<th scope="col">Periode</th>
						<th scope="col" class="text-right">Pemasukan</th>
						<th scope="col" class="text-right">Pengeluaran</th>
						<th scope="col" class="text-right">Selisih</th>
					</tr>
				</thead>
				<tbody>
					{#each points as p (p.start)}
						<tr>
							<td>{bucketTitle(p.start, bucket)}</td>
							<td class="text-right tabular-nums">{rupiah(p.income)}</td>
							<td class="text-right tabular-nums">{rupiah(p.expenses)}</td>
							<td class="text-right tabular-nums">{rupiah(p.income - p.expenses)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</details>
</figure>
