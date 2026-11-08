<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import SquareKanban from '@lucide/svelte/icons/square-kanban';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import BookingDrawer from '#lib/components/crm/BookingDrawer.svelte';
	import { EVENT_TYPES, EVENT_TYPE_LABEL, STAGES, STAGE_LABEL, stageTone } from '#lib/crm.ts';
	import { countdown, dateID, rupiah } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let drawerOpen = $state(false);
	const filtered = $derived(
		!!(data.filter.q || data.filter.stage || data.filter.eventType || data.filter.month)
	);
	const submitOnChange = (e: Event & { currentTarget: HTMLSelectElement | HTMLInputElement }) =>
		e.currentTarget.form?.requestSubmit();
</script>

<div class="page-body">
	<PageHeader title="Daftar booking" description="Semua booking dalam bentuk tabel.">
		{#snippet actions()}
			<a class="btn btn--secondary" href={resolve('admin/booking')}>
				<SquareKanban size={16} aria-hidden="true" /> Papan
			</a>
			{#if data.allow.create}
				<button type="button" class="btn btn--primary" onclick={() => (drawerOpen = true)}>
					<Plus size={16} aria-hidden="true" /> Booking baru
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<form
		method="get"
		action={resolve('admin/booking/daftar')}
		class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
		role="search"
		data-sveltekit-keepfocus
		data-sveltekit-replacestate
	>
		<label class="field">
			<span>Cari</span>
			<input
				type="search"
				name="q"
				class="input"
				placeholder="Judul atau nama klien"
				defaultValue={data.filter.q}
				autocomplete="off"
			/>
		</label>
		<label class="field">
			<span>Tahap</span>
			<select name="tahap" class="input" value={data.filter.stage ?? ''} onchange={submitOnChange}>
				<option value="">Semua tahap</option>
				{#each STAGES as s (s.key)}<option value={s.key}>{s.label}</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Jenis acara</span>
			<select
				name="jenis"
				class="input"
				value={data.filter.eventType ?? ''}
				onchange={submitOnChange}
			>
				<option value="">Semua jenis</option>
				{#each EVENT_TYPES as t (t.key)}<option value={t.key}>{t.label}</option>{/each}
			</select>
		</label>
		<label class="field">
			<span>Bulan sesi</span>
			<input
				type="month"
				name="bulan"
				class="input"
				defaultValue={data.filter.month ?? ''}
				onchange={submitOnChange}
			/>
		</label>
		<button type="submit" class="btn btn--secondary">Cari</button>
	</form>

	{#if data.rows.length === 0}
		<EmptyState
			message={filtered
				? 'Tidak ada booking yang cocok dengan filter ini.'
				: 'Belum ada booking. Buat booking pertama atau tunggu inquiry dari website.'}
		/>
	{:else}
		<section class="card table-wrap" aria-label="Daftar booking">
			<table class="table min-w-[56rem]">
				<thead>
					<tr>
						<th scope="col">Booking</th>
						<th scope="col">Klien</th>
						<th scope="col">Hari H</th>
						<th scope="col">Tahap</th>
						<th scope="col" class="text-right">Harga</th>
						<th scope="col">DP</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as b (b.id)}
						<tr>
							<td>
								<a
									class="font-semibold underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/booking/[id]', { id: b.id })}>{b.title}</a
								>
								<span class="block text-small text-ink-2">
									{EVENT_TYPE_LABEL[b.eventType]}{b.packageName ? ` · ${b.packageName}` : ''} · {b.sessions}
									sesi
								</span>
							</td>
							<td>
								<a
									class="underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/klien/[id]', { id: b.clientId })}>{b.clientName}</a
								>
							</td>
							<td class="whitespace-nowrap">
								{#if b.firstDate}
									{dateID(b.firstDate)}
									{#if b.stage !== 'lost' && b.stage !== 'completed'}<span
											class="block text-small font-semibold">{countdown(b.firstDate)}</span
										>{/if}
								{:else}<span class="text-ink-2">Belum ada</span>{/if}
							</td>
							<td><span class="chip {stageTone(b.stage)}">{STAGE_LABEL[b.stage]}</span></td>
							<td class="text-right tabular-nums">{rupiah(b.agreedPrice)}</td>
							<td>
								{#if b.stage === 'lost'}–{:else if b.bookedAt}<span class="chip chip--success"
										>Lunas</span
									>{:else}<span class="chip chip--warning">Belum</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>
	{/if}
</div>

<BookingDrawer
	bind:open={drawerOpen}
	bookingId={null}
	options={data.options}
	allowNewClient={data.allow.newClient}
/>
