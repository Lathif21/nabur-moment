<script lang="ts">
	import { Accordion } from 'bits-ui';
	import Plus from '@lucide/svelte/icons/plus';
	import { paragraphs, type FaqSnapshot } from '#lib/cms/lists.ts';

	type Props = { items: FaqSnapshot };

	let { items }: Props = $props();
</script>

<!-- One open at a time; buttons with aria-expanded, arrow keys move between questions (bits-ui) -->
<Accordion.Root type="single" class="divide-y divide-sage border-y border-sage">
	{#each items as item (item.id)}
		<Accordion.Item value={item.id}>
			<Accordion.Header level={2}>
				<Accordion.Trigger
					class="group flex w-full items-center justify-between gap-6 py-6 text-left font-display text-[1.25rem] leading-snug lg:text-[1.375rem]"
				>
					{item.question}
					<Plus
						size={20}
						strokeWidth={1.5}
						class="shrink-0 text-olive transition-transform group-data-[state=open]:rotate-45 motion-reduce:transition-none"
						aria-hidden="true"
					/>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Content class="flex flex-col gap-3 pr-10 pb-6 text-lead">
				{#each paragraphs(item.answer) as p, i (i)}<p>{p}</p>{/each}
			</Accordion.Content>
		</Accordion.Item>
	{/each}
</Accordion.Root>
