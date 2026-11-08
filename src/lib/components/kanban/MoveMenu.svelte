<script lang="ts">
	import { DropdownMenu } from 'bits-ui';
	import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';

	type Props = {
		/** The card's name, for the button label */
		itemLabel: string;
		/** Columns the card can move to (the current one excluded) */
		targets: { key: string; label: string }[];
		onmove: (key: string) => void;
		disabled?: boolean;
		/** Visible text instead of the icon (booking page), e.g. "Pindah tahap" */
		buttonText?: string;
	};

	let { itemLabel, targets, onmove, disabled = false, buttonText }: Props = $props();
</script>

<!-- "Pindah ke…": the keyboard / touch alternative to drag and drop -->
<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class={buttonText ? 'btn btn--secondary' : 'icon-btn size-8! shrink-0'}
		aria-label={buttonText ? undefined : `Pindahkan ${itemLabel}`}
		{disabled}
		onpointerdown={(e: PointerEvent) => e.stopPropagation()}
	>
		{#if buttonText}
			<ArrowRightLeft size={16} aria-hidden="true" />
			{buttonText}
		{:else}
			<Ellipsis size={16} aria-hidden="true" />
		{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={6}
			class="z-50 min-w-52 rounded-card border border-line bg-surface p-1.5 shadow-modal"
		>
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading class="px-3 pt-1.5 pb-1 text-small font-semibold text-ink-2"
					>Pindah ke…</DropdownMenu.GroupHeading
				>
				{#each targets as t (t.key)}
					<DropdownMenu.Item
						class="flex min-h-(--size-touch) cursor-pointer items-center rounded-card px-3 text-body data-highlighted:bg-sage-20"
						onSelect={() => onmove(t.key)}
					>
						{t.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>
