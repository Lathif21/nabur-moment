<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import PeriodFilter from '#lib/components/admin/PeriodFilter.svelte';
	import { EVENT_TYPE_LABEL, STAGE_LABEL, stageTone, waLink } from '#lib/crm.ts';
	import { dateID, phoneDisplay } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(resolve('/admin/(app)/kru/[id]', { id: data.crew.id }));
	const clients = $derived(new Set(data.jobs.map((j) => j.clientId)).size);
</script>

<div class="page-body">
	<a
		class="inline-flex items-center gap-1.5 text-small text-ink-2 hover:underline"
		href={resolve('admin/kru')}
	>
		<ArrowLeft size={14} aria-hidden="true" /> Semua kru
	</a>

	<PageHeader
		title={data.crew.name}
		description={[data.crew.role, data.crew.active ? null : 'Nonaktif']
			.filter(Boolean)
			.join(' · ') || undefined}
	>
		{#snippet actions()}
			{#if data.crew.phone}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- external wa.me chat link -->
				<a
					class="btn btn--secondary"
					href={waLink(data.crew.phone)}
					target="_blank"
					rel="noopener noreferrer"
				>
					<MessageCircle size={16} aria-hidden="true" />
					{phoneDisplay(data.crew.phone)}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		{/snippet}
	</PageHeader>

	<PeriodFilter value={data.period} {base} />

	<p class="text-body" role="status">
		<strong class="tabular-nums">{data.jobs.length}</strong> booking ·
		<strong class="tabular-nums">{clients}</strong> klien · {data.period.label}
	</p>

	{#if data.jobs.length === 0}
		<EmptyState
			icon={CalendarDays}
			message="Tidak ada booking (Booked ke atas) untuk kru ini di periode ini."
		/>
	{:else}
		<section class="card table-wrap" aria-label="Booking yang ditangani">
			<table class="table min-w-[48rem]">
				<thead>
					<tr>
						<th scope="col">Hari H</th>
						<th scope="col">Booking</th>
						<th scope="col">Sesi</th>
						<th scope="col">Tahap</th>
					</tr>
				</thead>
				<tbody>
					{#each data.jobs as j (j.id)}
						<tr>
							<td class="whitespace-nowrap tabular-nums">{j.hariH ? dateID(j.hariH) : '–'}</td>
							<td>
								{#if data.allow.bookings}
									<a
										class="font-semibold underline-offset-2 hover:underline"
										href={resolve('/admin/(app)/booking/[id]', { id: j.id })}>{j.title}</a
									>
								{:else}<span class="font-semibold">{j.title}</span>{/if}
								<span class="block text-small text-ink-2">
									{#if data.allow.clients}
										<a
											class="underline-offset-2 hover:underline"
											href={resolve('/admin/(app)/klien/[id]', { id: j.clientId })}
											>{j.clientName}</a
										>
									{:else}{j.clientName}{/if}
								</span>
							</td>
							<td>
								<ul class="flex flex-col gap-0.5 text-small">
									{#each j.sessions as s, i (i)}
										<li>
											<span class="font-semibold">{EVENT_TYPE_LABEL[s.eventType]}</span>
											{#if s.date}· {dateID(s.date)}{/if}
											{#if s.startTime}· {s.startTime}{/if}
											{#if s.venue || s.city}<span class="text-ink-2">
													· {[s.venue, s.city].filter(Boolean).join(', ')}</span
												>{/if}
										</li>
									{/each}
								</ul>
							</td>
							<td><span class="chip {stageTone(j.stage)}">{STAGE_LABEL[j.stage]}</span></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>
