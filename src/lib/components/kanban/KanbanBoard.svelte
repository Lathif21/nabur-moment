<script lang="ts" module>
	import { setAriaStrings, setKeyboardDragTrigger } from 'svelte-dnd-action';

	// Space lifts / drops a focused card; Enter stays free for the buttons inside it
	setKeyboardDragTrigger('space');

	// Screen-reader messages of svelte-dnd-action in Bahasa Indonesia (global, set once)
	setAriaStrings({
		dragStarted: ({ itemLabel, zoneLabel }) =>
			`${itemLabel} diangkat dari ${zoneLabel}. Gunakan tombol panah untuk memindahkan, spasi untuk melepas.`,
		movedToPosition: ({ itemLabel, zoneLabel, position, count }) =>
			`${itemLabel} di ${zoneLabel}, posisi ${position} dari ${count}.`,
		movedToZoneStart: ({ itemLabel, zoneLabel }) => `${itemLabel} di awal ${zoneLabel}.`,
		movedToZoneEnd: ({ itemLabel, zoneLabel }) => `${itemLabel} di akhir ${zoneLabel}.`,
		dropped: ({ itemLabel, zoneLabel, position, count }) =>
			`${itemLabel} dilepas di ${zoneLabel}, posisi ${position} dari ${count}.`,
		zoneActiveInstruction:
			'Tekan spasi pada kartu untuk mulai memindahkan, atau gunakan menu Pindah ke.',
		zoneDragDisabledInstruction: 'Gunakan menu Pindah ke pada kartu untuk memindahkan.'
	});

	export type KanbanColumn = {
		key: string;
		label: string;
		/** Starts collapsed to a narrow strip (Batal); still a drop target */
		collapsed?: boolean;
	};

	export type CardContext = {
		/** Column the card is in */
		column: string;
		/** Columns it can move to, for MoveMenu */
		targets: { key: string; label: string }[];
		/** Move to the bottom of another column (the "Pindah ke…" path) */
		moveTo: (key: string) => void;
		/** A move is being saved; disable the menu */
		busy: boolean;
	};
</script>

<script lang="ts" generics="T extends { id: string }">
	// Generic drag-and-drop board (adapted from the Befisien CRM): optimistic move, rollback on
	// failure, "Pindah ke…" menu as the keyboard / touch alternative.
	import { untrack, type Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import {
		dndzone,
		SHADOW_ITEM_MARKER_PROPERTY_NAME,
		TRIGGERS,
		type DndEvent
	} from 'svelte-dnd-action';
	import ChevronsLeftRight from '@lucide/svelte/icons/chevrons-left-right';
	import {
		cloneLanes,
		findCard,
		moveCard,
		neighbours,
		samePlace,
		type KanbanMove,
		type Lanes
	} from '#lib/kanban.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		/** Accessible name of the board, e.g. "Pipeline booking" */
		label: string;
		columns: KanbanColumn[];
		/** Server state: the cards of every column in display order */
		lanes: Lanes<T>;
		/** Card name for screen readers and menus */
		itemLabel: (item: T) => string;
		/** Column header total, e.g. rupiahShort(sum); null hides it */
		total?: (items: T[]) => string | null;
		card: Snippet<[T, CardContext]>;
		/**
		 * Persist a move. Resolve to keep it, return false or throw to roll back (throw an Error with
		 * an Indonesian message to show it). The board already shows the move while this runs.
		 */
		onMove: (move: KanbanMove) => Promise<boolean | void>;
		/** Cards can only be dropped on boards of the same type */
		type?: string;
	};

	let { label, columns, lanes, itemLabel, total, card, onMove, type = 'kanban' }: Props = $props();

	const FLIP_MS = 150;

	// What the board shows: the server lanes plus any move in flight
	// Start from the server lanes so the first paint (and SSR) already shows the cards
	let view = $state<Lanes<T>>(untrack(() => cloneLanes(lanes)));
	let dragging = $state(false);
	let saving = $state(false);
	let snapshot: Lanes<T> | null = null;
	/** Server data that arrived during a drag or a save; applied once the board is idle */
	let pending: Lanes<T> | null = null;
	let expanded = $state<Record<string, boolean>>({});

	// Follow new server data (only `lanes` is tracked). Never swap the cards out from under a
	// drag or a save; keep the latest data and apply it when that finishes.
	$effect(() => {
		const next = cloneLanes(lanes);
		if (untrack(() => dragging || saving)) pending = next;
		else view = next;
	});

	function applyPending() {
		if (pending && !dragging && !saving) {
			view = pending;
			pending = null;
		}
	}

	// Touch screens move cards with the menu instead of dragging
	let coarsePointer = $state(false);
	$effect(() => {
		const mq = window.matchMedia('(pointer: coarse)');
		coarsePointer = mq.matches;
		const onChange = () => (coarsePointer = mq.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const isShadow = (item: T) =>
		(item as Record<string, unknown>)[SHADOW_ITEM_MARKER_PROPERTY_NAME] === true;
	const realItems = (key: string) => (view[key] ?? []).filter((i) => !isShadow(i));

	async function commit(before: Lanes<T>, after: Lanes<T>, id: string) {
		const from = findCard(before, id)?.key;
		const at = findCard(after, id);
		if (!from || !at || samePlace(before, after, id)) {
			view = after;
			return;
		}
		view = after;
		saving = true;
		try {
			const ok = await onMove({ id, from, to: at.key, ...neighbours(after[at.key], id) });
			if (ok === false) {
				view = before;
				pending = null;
			}
		} catch (e) {
			view = before;
			pending = null;
			toast.error(
				e instanceof Error && e.message ? e.message : 'Kartu gagal dipindahkan. Coba lagi.'
			);
		} finally {
			saving = false;
			applyPending();
		}
	}

	function onConsider(key: string, e: CustomEvent<DndEvent<T>>) {
		if (e.detail.info.trigger === TRIGGERS.DRAG_STARTED) {
			snapshot = cloneLanes(view);
			dragging = true;
		}
		view[key] = e.detail.items;
	}

	function onFinalize(key: string, e: CustomEvent<DndEvent<T>>) {
		view[key] = e.detail.items;
		// finalize fires in the source and the target zone; act once, in the zone it landed in
		if (e.detail.info.trigger !== TRIGGERS.DROPPED_INTO_ZONE) {
			if (e.detail.info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY) {
				dragging = false;
				applyPending();
			}
			return;
		}
		dragging = false;
		const before = snapshot ?? cloneLanes(view);
		snapshot = null;
		void commit(before, cloneLanes(view), e.detail.info.id);
	}

	function moveTo(id: string, key: string) {
		const after = moveCard(view, id, key);
		if (after) void commit(cloneLanes(view), after, id);
	}

	function markDragged(el?: HTMLElement) {
		el?.querySelector('.kcard')?.classList.add('kcard--dragging');
	}
</script>

<!-- Horizontal board; on phones the columns snap one by one -->
<section
	class="-mx-4 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6"
	aria-label={label}
	aria-busy={saving}
>
	{#each columns as col (col.key)}
		{@const items = view[col.key] ?? []}
		{@const count = realItems(col.key).length}
		{@const collapsed = col.collapsed && !expanded[col.key]}
		{@const sum = total?.(realItems(col.key)) ?? null}
		<div
			class={[
				'flex min-h-[min(70dvh,640px)] shrink-0 snap-start flex-col gap-2.5 rounded-card bg-sage-20 p-2.5',
				collapsed ? 'w-[88px]' : 'w-[272px] max-sm:w-[calc(100vw-56px)]'
			]}
			role="group"
			aria-label="{col.label}, {count} kartu"
		>
			{#if collapsed}
				<button
					type="button"
					class="flex flex-col items-center gap-1.5 rounded-card py-2 text-center hover:bg-surface/70"
					aria-expanded="false"
					onclick={() => (expanded[col.key] = true)}
					title="Buka kolom {col.label}"
				>
					<span class="text-small leading-tight font-semibold">{col.label}</span>
					<span class="kcol-count">{count}</span>
					{#if sum}<span class="text-[11px] font-semibold text-ink-2">{sum}</span>{/if}
					<ChevronsLeftRight size={15} aria-hidden="true" class="text-ink-2" />
				</button>
			{:else}
				<div class="flex min-h-9 items-center gap-2 px-1">
					<h2 class="min-w-0 truncate text-body font-semibold">{col.label}</h2>
					<span class="kcol-count">{count}</span>
					<span class="flex-1"></span>
					{#if sum}<span class="shrink-0 text-small font-semibold whitespace-nowrap text-ink-2"
							>{sum}</span
						>{/if}
					{#if col.collapsed}
						<button
							type="button"
							class="icon-btn size-7! shrink-0"
							aria-expanded="true"
							aria-label="Ciutkan kolom {col.label}"
							onclick={() => (expanded[col.key] = false)}
						>
							<ChevronsLeftRight size={14} aria-hidden="true" />
						</button>
					{/if}
				</div>
			{/if}

			<!-- The drop zone fills the column (drop anywhere below the last card) and stays in the
				collapsed column with the cards hidden, so Batal accepts drops. Every child of the zone
				must be a card, so the empty-state text is an overlay outside it. -->
			<div class="relative flex flex-1 flex-col">
				{#if count === 0 && !collapsed && !dragging}
					<p
						class="pointer-events-none absolute inset-x-0 top-0 rounded-card border border-dashed border-line px-3 py-6 text-center text-small text-ink-2"
					>
						Belum ada booking
					</p>
				{/if}
				<div
					class="flex flex-1 flex-col gap-2.5 rounded-card"
					aria-label={col.label}
					use:dndzone={{
						items,
						type,
						flipDurationMs: FLIP_MS,
						dragDisabled: saving || coarsePointer,
						dropTargetClasses: ['kcol-drop'],
						dropTargetStyle: {},
						// aim with the pointer, not the centre of the dragged card
						useCursorForDetection: true,
						transformDraggedElement: markDragged,
						delayTouchStart: true
					}}
					onconsider={(e) => onConsider(col.key, e)}
					onfinalize={(e) => onFinalize(col.key, e)}
				>
					{#each items as item (item.id)}
						<div
							animate:flip={{ duration: FLIP_MS }}
							aria-label={itemLabel(item)}
							class={collapsed ? 'sr-only' : undefined}
						>
							{#if isShadow(item)}
								<div
									class="min-h-24 rounded-card border-2 border-dashed border-line bg-surface/50"
								></div>
							{:else if !collapsed}
								{@render card(item, {
									column: col.key,
									targets: columns
										.filter((c) => c.key !== col.key)
										.map((c) => ({ key: c.key, label: c.label })),
									moveTo: (key) => moveTo(item.id, key),
									busy: saving
								})}
							{:else}
								{itemLabel(item)}
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/each}
</section>

<style>
	.kcol-count {
		min-width: 1.5rem;
		border-radius: var(--radius-chip);
		background: var(--color-surface);
		padding: 0 0.375rem;
		text-align: center;
		font-size: var(--text-small);
		font-weight: 600;
		color: var(--color-ink-2);
	}
	:global(.kcol-drop) {
		outline: 2px dashed var(--color-olive);
		outline-offset: 2px;
	}
	:global(.kcard--dragging) {
		box-shadow: var(--shadow-modal);
		transform: rotate(1.5deg);
	}
</style>
