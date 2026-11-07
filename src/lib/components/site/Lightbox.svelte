<script lang="ts">
	import { Dialog } from 'bits-ui';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';

	type Photo = { src: string; srcset: string | null; alt: string; caption: string };

	type Props = {
		photos: Photo[];
		open: boolean;
		/** Photo on screen */
		index: number;
	};

	let { photos, open = $bindable(), index = $bindable() }: Props = $props();

	const current = $derived(photos[index]);
	let startX = 0;

	function go(by: number) {
		index = (index + by + photos.length) % photos.length;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') go(1);
		if (e.key === 'ArrowLeft') go(-1);
	}
</script>

<!-- Photo viewer: arrows / swipe to move, Esc or the X to close (focus is trapped by the dialog) -->
<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-forest/95" />
		<Dialog.Content
			class="fixed inset-0 z-50 flex flex-col text-cream outline-none"
			{onkeydown}
			onpointerdown={(e) => (startX = e.clientX)}
			onpointerup={(e) => {
				const dx = e.clientX - startX;
				if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
			}}
		>
			<Dialog.Title class="sr-only">Foto {index + 1} dari {photos.length}</Dialog.Title>
			<div class="flex items-center justify-between px-4 py-3">
				<span class="text-caption tracking-[0.16em] tabular-nums" aria-hidden="true"
					>{index + 1} / {photos.length}</span
				>
				<Dialog.Close
					type="button"
					class="inline-flex size-11 items-center justify-center"
					aria-label="Tutup foto"
				>
					<X size={26} strokeWidth={1.5} aria-hidden="true" />
				</Dialog.Close>
			</div>
			{#if current}
				<figure class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 pb-6">
					<img
						src={current.src}
						srcset={current.srcset ?? undefined}
						sizes="100vw"
						alt={current.alt}
						class="max-h-full min-h-0 max-w-full object-contain select-none"
						draggable="false"
					/>
					{#if current.caption}<figcaption class="text-center text-small">
							{current.caption}
						</figcaption>{/if}
				</figure>
			{/if}
			{#if photos.length > 1}
				<button
					type="button"
					class="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-forest/60"
					aria-label="Foto sebelumnya"
					onclick={() => go(-1)}
				>
					<ChevronLeft size={26} strokeWidth={1.5} aria-hidden="true" />
				</button>
				<button
					type="button"
					class="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-forest/60"
					aria-label="Foto berikutnya"
					onclick={() => go(1)}
				>
					<ChevronRight size={26} strokeWidth={1.5} aria-hidden="true" />
				</button>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
