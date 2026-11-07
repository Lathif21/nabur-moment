<script lang="ts">
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import StatTile from '#lib/components/admin/StatTile.svelte';
	import { rupiahShort } from '#lib/format.ts';
</script>

<!-- Placeholder until the Dashboard (P3-06) -->
<div class="page-body">
	<PageHeader title="Dashboard" description="Ringkasan bulan ini." />
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatTile label="Pemasukan" value={rupiahShort(0)} />
		<StatTile label="Pengeluaran" value={rupiahShort(0)} />
		<StatTile label="Laba bersih" value={rupiahShort(0)} variant="dark" />
		<StatTile label="Piutang" value={rupiahShort(0)} />
	</div>
	<EmptyState
		icon={LayoutDashboard}
		message="Data muncul setelah booking dan pembayaran dicatat."
	/>
</div>
