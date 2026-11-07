<script lang="ts">
	import Hammer from '@lucide/svelte/icons/hammer';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="page-body">
	<PageHeader title={data.title} />
	<EmptyState icon={Hammer} message="Halaman ini sedang dibangun." />
</div>
