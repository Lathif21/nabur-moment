<script lang="ts">
	type Props = {
		src: string;
		/** 0–1 from the left / top */
		x: number;
		y: number;
	};

	let { src, x = $bindable(), y = $bindable() }: Props = $props();

	const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));

	function fromPointer(e: PointerEvent & { currentTarget: HTMLElement }) {
		const r = e.currentTarget.getBoundingClientRect();
		x = clamp((e.clientX - r.left) / r.width);
		y = clamp((e.clientY - r.top) / r.height);
	}

	/** Keyboard alternative: arrows move 5 %, Shift moves 1 % */
	function onkeydown(e: KeyboardEvent) {
		const step = e.shiftKey ? 0.01 : 0.05;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step]
		};
		const m = moves[e.key];
		if (!m) return;
		e.preventDefault();
		x = clamp(x + m[0]);
		y = clamp(y + m[1]);
	}
</script>

<div class="flex flex-col gap-2">
	<button
		type="button"
		aria-label="Titik fokus: klik gambar atau pakai tombol panah. Sekarang {Math.round(
			x * 100
		)}% dari kiri, {Math.round(y * 100)}% dari atas."
		class="relative block w-full cursor-crosshair overflow-hidden rounded-card border border-line select-none"
		onpointerdown={fromPointer}
		{onkeydown}
	>
		<img {src} alt="" class="block w-full" draggable="false" />
		<span
			class="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cream shadow-[0_0_0_2px_var(--color-forest)]"
			style:left="{x * 100}%"
			style:top="{y * 100}%"
			aria-hidden="true"
		></span>
	</button>
	<p class="text-[0.75rem] text-ink-2 tabular-nums">
		Fokus {Math.round(x * 100)}% · {Math.round(y * 100)}%. Bagian ini tetap terlihat saat gambar
		dipotong.
	</p>
	<input type="hidden" name="focalX" value={x} />
	<input type="hidden" name="focalY" value={y} />
</div>
