<script lang="ts" generics="T extends { id: string }">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import type { Snippet } from 'svelte';
	import { dndzone, type DndEvent } from 'svelte-dnd-action';

	type Props = {
		items: T[];
		/** Accessible name of the list, e.g. "Urutan FAQ" */
		label: string;
		/** Name of one item for the move buttons, e.g. item.question */
		itemName: (item: T) => string;
		/** Called with the full new order after a drag or a move button */
		onreorder: (ids: string[]) => void;
		row: Snippet<[T, number]>;
		disabled?: boolean;
	};

	let { items, label, itemName, onreorder, row, disabled = false }: Props = $props();

	// Local copy while dragging; follows the server data otherwise (writable derived)
	let local = $derived<T[]>([...items]);

	const FLIP_MS = 150;

	function consider(e: CustomEvent<DndEvent<T>>) {
		local = e.detail.items;
	}

	function finalize(e: CustomEvent<DndEvent<T>>) {
		local = e.detail.items;
		onreorder(local.map((i) => i.id));
	}

	/** Keyboard alternative to dragging */
	function move(i: number, by: number) {
		const j = i + by;
		if (j < 0 || j >= local.length) return;
		const next = [...local];
		[next[i], next[j]] = [next[j], next[i]];
		local = next;
		onreorder(next.map((x) => x.id));
	}
</script>

<ul
	class="flex flex-col gap-2"
	aria-label={label}
	use:dndzone={{
		items: local,
		flipDurationMs: FLIP_MS,
		dragDisabled: disabled,
		dropTargetStyle: {},
		type: label
	}}
	onconsider={consider}
	onfinalize={finalize}
>
	{#each local as item, i (item.id)}
		<li class="flex items-stretch gap-2 rounded-card border border-line bg-surface">
			{#if !disabled}
				<span
					class="flex cursor-grab items-center pl-2 text-ink-2 active:cursor-grabbing"
					aria-hidden="true"
				>
					<GripVertical size={16} />
				</span>
			{/if}
			<div class="min-w-0 flex-1 py-3 pr-1 {disabled ? 'pl-4' : ''}">
				{@render row(item, i)}
			</div>
			{#if !disabled}
				<div class="flex flex-col justify-center pr-2">
					<button
						type="button"
						class="icon-btn size-8!"
						aria-label="Naikkan {itemName(item)}"
						disabled={i === 0}
						onclick={() => move(i, -1)}><ArrowUp size={14} aria-hidden="true" /></button
					>
					<button
						type="button"
						class="icon-btn size-8!"
						aria-label="Turunkan {itemName(item)}"
						disabled={i === local.length - 1}
						onclick={() => move(i, 1)}><ArrowDown size={14} aria-hidden="true" /></button
					>
				</div>
			{/if}
		</li>
	{/each}
</ul>
