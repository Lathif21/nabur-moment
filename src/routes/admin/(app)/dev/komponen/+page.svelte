<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import Modal from '#lib/components/admin/Modal.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import StatTile from '#lib/components/admin/StatTile.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import MediaPicker from '#lib/components/media/MediaPicker.svelte';
	import { rupiah, rupiahShort } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	let drawerOpen = $state(false);
	let modalOpen = $state(false);
	let confirmOpen = $state(false);
	let price = $state<number | null>(12_500_000);
	let pickerOpen = $state(false);
	let picked = $state<string[]>([]);
</script>

<!-- Component gallery for design review (P0-04). Not in the sidebar; remove before launch. -->
<div class="page-body">
	<PageHeader title="Komponen" description="Contoh komponen admin untuk tinjauan desain.">
		{#snippet actions()}
			<button type="button" class="btn btn--primary" onclick={() => (drawerOpen = true)}>
				<Plus size={16} aria-hidden="true" /> Booking baru
			</button>
		{/snippet}
	</PageHeader>

	<section class="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Contoh KPI">
		<StatTile
			label="Pemasukan"
			value={rupiahShort(86_500_000)}
			delta={{ pct: 35, upIsGood: true }}
		/>
		<StatTile
			label="Pengeluaran"
			value={rupiahShort(31_200_000)}
			delta={{ pct: 12, upIsGood: false }}
		/>
		<StatTile
			label="Laba bersih"
			value={rupiahShort(55_300_000)}
			delta={{ pct: -8, upIsGood: true }}
			variant="dark"
		/>
		<StatTile label="Piutang" value={rupiahShort(42_000_000)} note="5 invoice terbuka" />
	</section>

	<section class="card flex flex-col gap-4 p-5">
		<h2 class="font-display text-section-title">Tombol &amp; chip</h2>
		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn btn--primary">Simpan</button>
			<button type="button" class="btn btn--secondary">Batal</button>
			<button type="button" class="btn btn--ghost">Lainnya</button>
			<button type="button" class="btn btn--danger" onclick={() => (confirmOpen = true)}>
				Batalkan invoice
			</button>
			<button type="button" class="btn btn--secondary" onclick={() => (modalOpen = true)}>
				Buka modal
			</button>
			<button
				type="button"
				class="btn btn--secondary"
				onclick={() => toast.success('Pembayaran dicatat.')}>Toast</button
			>
		</div>
		<div class="flex flex-wrap gap-2">
			<span class="chip">Inquiry</span>
			<span class="chip chip--success">Lunas</span>
			<span class="chip chip--warning">DP jatuh tempo</span>
			<span class="chip chip--danger">Terlambat</span>
		</div>
	</section>

	<section class="rounded-card bg-sage-20 p-4">
		<p class="text-body">Latar kolom kanban (sage-20) dengan teks forest.</p>
	</section>

	<section class="card flex flex-col gap-3 p-5">
		<h2 class="font-display text-section-title">Media picker</h2>
		<button type="button" class="btn btn--secondary w-fit" onclick={() => (pickerOpen = true)}>
			Pilih media
		</button>
		<p class="text-small">
			Terpilih: <output data-testid="picked-ids">{picked.join(',') || '-'}</output>
		</p>
	</section>

	<EmptyState message="Belum ada klien. Tambahkan klien pertama.">
		{#snippet action()}
			<button type="button" class="btn btn--primary">Tambah klien</button>
		{/snippet}
	</EmptyState>
</div>

<Drawer bind:open={drawerOpen} title="Booking baru" description="Contoh form di drawer.">
	<form id="demo-form" class="flex flex-col gap-4" onsubmit={(e) => e.preventDefault()}>
		<Field label="Judul" name="title" required>
			{#snippet children(attrs)}
				<input {...attrs} class="input" defaultValue="Wedding Nadia & Raka" />
			{/snippet}
		</Field>
		<Field label="Harga disepakati" name="agreed_price" hint={price ? rupiah(price) : undefined}>
			{#snippet children(attrs)}
				<MoneyInput {...attrs} bind:value={price} />
			{/snippet}
		</Field>
		<Field label="Kota" name="city" errors={['Kota wajib diisi.']}>
			{#snippet children(attrs)}
				<input {...attrs} class="input" />
			{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (drawerOpen = false)}>
			Batal
		</button>
		<button type="submit" form="demo-form" class="btn btn--primary">Simpan</button>
	{/snippet}
</Drawer>

<Modal bind:open={modalOpen} title="DP belum lunas">
	<p>Booking hanya bisa dipindah ke Booked setelah DP dibayar.</p>
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (modalOpen = false)}>
			Nanti
		</button>
		<button type="button" class="btn btn--primary">Catat pembayaran DP</button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Batalkan invoice?"
	action="?/demo"
	fields={{ id: 'demo' }}
	confirmLabel="Batalkan invoice"
	tone="danger"
>
	Invoice <strong>INV/NM/2026/11/001</strong> akan dibatalkan (void) dan tidak bisa dipakai lagi.
</ConfirmDialog>

<MediaPicker bind:open={pickerOpen} multiple value={picked} onselect={(ids) => (picked = ids)} />
