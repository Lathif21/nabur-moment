<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ShieldX from '@lucide/svelte/icons/shield-x';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';

	const status = $derived(page.status);
	const title = $derived(
		status === 403 ? 'Akses ditolak' : status === 404 ? 'Tidak ditemukan' : 'Terjadi kesalahan'
	);
	const icon = $derived(status === 403 ? ShieldX : status === 404 ? SearchX : TriangleAlert);
</script>

<div class="page-body">
	<PageHeader {title} />
	<EmptyState {icon} message={page.error?.message ?? 'Coba lagi beberapa saat lagi.'}>
		{#snippet action()}
			<a href={resolve('admin')} class="btn btn--secondary">Kembali</a>
		{/snippet}
	</EmptyState>
</div>
