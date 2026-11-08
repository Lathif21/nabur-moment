<script lang="ts">
	// Activity timeline (P2-04): newest first, with type, author and time in WIB. Used on the
	// booking page and the client page (where each entry links to its booking).
	import { resolve } from '$app/paths';
	import { ACTIVITY_LABEL, STAGE_LABEL, type Stage } from '#lib/crm.ts';
	import { dateID } from '#lib/format.ts';

	type Item = {
		id: string;
		type: string;
		body: string | null;
		meta: Record<string, unknown> | null;
		occurredAt: Date | string;
		bookingId: string | null;
		bookingTitle: string | null;
		userName: string | null;
	};

	type Props = {
		items: Item[];
		/** Show which booking each entry belongs to (client page) */
		showBooking?: boolean;
		/** Accessible name of the list */
		label?: string;
	};

	let { items, showBooking = false, label = 'Aktivitas' }: Props = $props();

	/** Stage changes read "Inquiry → Konsultasi" */
	function headline(a: Item) {
		if (a.type !== 'stage_change' || !a.meta) return null;
		const { from, to } = a.meta as { from?: Stage; to?: Stage };
		return from && to ? `${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}` : null;
	}

	const stamp = (d: Date | string) => `${dateID(d)}, ${dateID(d, 'time')} WIB`;
</script>

{#if items.length === 0}
	<p class="text-body text-ink-2">Belum ada aktivitas.</p>
{:else}
	<ol class="flex flex-col gap-3" aria-label={label}>
		{#each items as a (a.id)}
			{@const title = headline(a)}
			<li class="card px-4 py-3" data-activity-type={a.type}>
				<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-2">
					<span class="chip">{ACTIVITY_LABEL[a.type] ?? a.type}</span>
					<time datetime={new Date(a.occurredAt).toISOString()}>{stamp(a.occurredAt)}</time>
					<span>· {a.userName ?? 'Sistem'}</span>
				</p>
				{#if title}<p class="mt-1.5 text-body font-semibold">{title}</p>{/if}
				{#if a.body}<p class="mt-1.5 text-body break-words whitespace-pre-line">{a.body}</p>{/if}
				{#if showBooking && a.bookingId && a.bookingTitle}
					<a
						class="mt-1 inline-block text-small text-ink-2 underline-offset-2 hover:underline"
						href={resolve('/admin/(app)/booking/[id]', { id: a.bookingId })}>{a.bookingTitle}</a
					>
				{/if}
			</li>
		{/each}
	</ol>
{/if}
