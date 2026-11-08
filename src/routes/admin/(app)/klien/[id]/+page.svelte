<script lang="ts">
	import { resolve } from '$app/paths';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-arrow-up';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Mail from '@lucide/svelte/icons/mail';
	import Camera from '@lucide/svelte/icons/camera';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import StatTile from '#lib/components/admin/StatTile.svelte';
	import ActivityTimeline from '#lib/components/crm/ActivityTimeline.svelte';
	import ClientDrawer from '#lib/components/crm/ClientDrawer.svelte';
	import { EVENT_TYPE_LABEL, STAGE_LABEL, igLink, stageTone, waLink } from '#lib/crm.ts';
	import { dateID, phoneDisplay, rupiah, rupiahShort } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const c = $derived(data.client);
	let editOpen = $state(false);
	let archiveOpen = $state(false);
</script>

<div class="page-body">
	<a
		class="inline-flex items-center gap-1.5 text-small text-ink-2 hover:underline"
		href={resolve('admin/klien')}
	>
		<ArrowLeft size={14} aria-hidden="true" /> Semua klien
	</a>

	<PageHeader
		title={c.name}
		description={[c.city, c.sourceName && `via ${c.sourceName}`, `sejak ${dateID(c.createdAt)}`]
			.filter(Boolean)
			.join(' · ')}
	>
		{#snippet actions()}
			{#if data.allow.update}
				<button type="button" class="btn btn--secondary" onclick={() => (editOpen = true)}>
					<Pencil size={16} aria-hidden="true" /> Ubah
				</button>
			{/if}
			{#if c.archivedAt ? data.allow.update : data.allow.delete}
				<button type="button" class="btn btn--ghost" onclick={() => (archiveOpen = true)}>
					{#if c.archivedAt}<ArchiveRestore size={16} aria-hidden="true" />{:else}<Archive
							size={16}
							aria-hidden="true"
						/>{/if}
					{c.archivedAt ? 'Kembalikan' : 'Arsipkan'}
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if c.archivedAt}
		<p class="rounded-card border border-line bg-sage-20 px-4 py-3 text-body" role="status">
			Klien ini diarsipkan pada {dateID(c.archivedAt)}. Tidak muncul di daftar aktif.
		</p>
	{/if}

	<!-- eslint-disable svelte/no-navigation-without-resolve -- external WhatsApp / Instagram / mailto links -->
	<div class="flex flex-wrap gap-2" aria-label="Hubungi klien">
		{#if c.phone}
			<a class="btn btn--primary" href={waLink(c.phone)} target="_blank" rel="noopener noreferrer">
				<MessageCircle size={16} aria-hidden="true" /> WhatsApp {phoneDisplay(c.phone)}
			</a>
		{/if}
		{#if c.instagram}
			<a
				class="btn btn--secondary"
				href={igLink(c.instagram)}
				target="_blank"
				rel="noopener noreferrer"
			>
				<Camera size={16} aria-hidden="true" /> @{c.instagram}
			</a>
		{/if}
		{#if c.email}
			<a class="btn btn--secondary" href="mailto:{c.email}">
				<Mail size={16} aria-hidden="true" />
				{c.email}
			</a>
		{/if}
		{#if !c.phone && !c.instagram && !c.email}
			<p class="text-body text-ink-2">Belum ada kontak. Tambahkan WhatsApp lewat tombol Ubah.</p>
		{/if}
	</div>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<div class="grid gap-3 sm:grid-cols-3">
		<StatTile
			label="Nilai booking"
			value={rupiahShort(data.totals.value)}
			note="Tanpa booking batal"
		/>
		<StatTile
			label="Sudah dibayar"
			value={rupiahShort(data.totals.paid)}
			note="Tercatat di Keuangan"
		/>
		<StatTile label="Sisa tagihan" value={rupiahShort(data.totals.outstanding)} />
	</div>

	<div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
		<section class="flex flex-col gap-3" aria-labelledby="bookings-title">
			<h2 id="bookings-title" class="font-display text-section-title">Booking</h2>
			{#if data.bookings.length === 0}
				<EmptyState message="Belum ada booking untuk klien ini." />
			{:else}
				<ul class="card divide-y divide-line">
					{#each data.bookings as b (b.id)}
						<li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
							<div class="min-w-0">
								<a
									class="font-semibold underline-offset-2 hover:underline"
									href={resolve('/admin/(app)/booking/[id]', { id: b.id })}>{b.title}</a
								>
								<p class="text-small text-ink-2">
									{EVENT_TYPE_LABEL[b.eventType]} · {b.firstDate
										? `Hari H ${dateID(b.firstDate)}`
										: 'Tanggal belum ditentukan'}
								</p>
							</div>
							<div class="flex items-center gap-3">
								<span class="tabular-nums">{rupiah(b.agreedPrice)}</span>
								<span class="chip {stageTone(b.stage)}">{STAGE_LABEL[b.stage]}</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			{#if c.notes}
				<h2 class="mt-3 font-display text-section-title">Catatan</h2>
				<p class="card px-4 py-3 text-body whitespace-pre-line">{c.notes}</p>
			{/if}
		</section>

		<section class="flex flex-col gap-3" aria-labelledby="activity-title">
			<h2 id="activity-title" class="font-display text-section-title">Aktivitas</h2>
			<ActivityTimeline items={data.activities} showBooking label="Aktivitas klien" />
		</section>
	</div>
</div>

<ClientDrawer bind:open={editOpen} client={c} sources={data.sources} action="?/update" />

<ConfirmDialog
	bind:open={archiveOpen}
	title={c.archivedAt ? 'Kembalikan klien?' : 'Arsipkan klien?'}
	action="?/archive"
	fields={{ id: c.id, archived: c.archivedAt ? 'false' : 'true' }}
	confirmLabel={c.archivedAt ? 'Kembalikan' : 'Arsipkan'}
>
	{#if c.archivedAt}
		<strong>{c.name}</strong> muncul lagi di daftar klien aktif.
	{:else}
		<strong>{c.name}</strong> disembunyikan dari daftar. Booking dan riwayatnya tetap tersimpan.
	{/if}
</ConfirmDialog>
