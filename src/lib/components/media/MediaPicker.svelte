<script lang="ts">
	import { resolve } from '$app/paths';
	import Modal from '#lib/components/admin/Modal.svelte';
	import EmptyState from '#lib/components/admin/EmptyState.svelte';
	import MediaGrid from './MediaGrid.svelte';
	import MediaUploader from './MediaUploader.svelte';
	import { KIND_LABELS, type MediaItem, type MediaKind } from '#lib/media/types.ts';

	type Props = {
		open: boolean;
		/** Several items (album, gallery) or exactly one (hero image) */
		multiple?: boolean;
		/** Limit to some kinds, e.g. ['image'] for an image field */
		kinds?: MediaKind[];
		/** Already chosen ids, ticked when the picker opens */
		value?: string[];
		title?: string;
		onselect: (ids: string[], items: MediaItem[]) => void;
	};

	let {
		open = $bindable(),
		multiple = false,
		kinds = ['image', 'video', 'embed'],
		value = [],
		title = 'Pilih media',
		onselect
	}: Props = $props();

	let items = $state<MediaItem[]>([]);
	let filter = $state<MediaKind | ''>('');
	let chosen = $state<string[]>([]);
	let loading = $state(false);
	let failed = $state('');

	const shown = $derived(
		items.filter((m) => kinds.includes(m.kind) && (!filter || m.kind === filter))
	);

	async function load() {
		loading = true;
		failed = '';
		try {
			const res = await fetch(resolve('admin/api/media'), {
				headers: { accept: 'application/json' }
			});
			if (!res.ok) throw new Error(`Gagal memuat media (${res.status}).`);
			items = await res.json();
		} catch (e) {
			failed = (e as Error).message;
		} finally {
			loading = false;
		}
	}

	// Fresh list and the current selection every time it opens
	$effect(() => {
		if (open) {
			chosen = [...value];
			filter = '';
			void load();
		}
	});

	function toggle(m: MediaItem) {
		if (!multiple) {
			chosen = [m.id];
			return;
		}
		chosen = chosen.includes(m.id) ? chosen.filter((id) => id !== m.id) : [...chosen, m.id];
	}

	function confirm() {
		const byId = new Map(items.map((m) => [m.id, m]));
		onselect(
			chosen,
			chosen.map((id) => byId.get(id)).filter((m): m is MediaItem => !!m)
		);
		open = false;
	}
</script>

<Modal
	bind:open
	{title}
	size="xl"
	description={multiple ? 'Pilih satu atau lebih.' : 'Pilih satu.'}
>
	<div class="flex flex-col gap-4">
		{#if kinds.some((k) => k !== 'embed')}
			<MediaUploader
				compact
				onuploaded={(item) => {
					items = [item, ...items];
					if (kinds.includes(item.kind)) toggle(item);
				}}
			/>
		{/if}

		{#if kinds.length > 1}
			<div class="flex flex-wrap gap-1.5" role="group" aria-label="Jenis media">
				{#each [['', 'Semua'], ...kinds.map((k) => [k, KIND_LABELS[k]])] as [k, label] (k)}
					<button
						type="button"
						class={['btn btn--sm', filter === k ? 'btn--primary' : 'btn--secondary']}
						aria-pressed={filter === k}
						onclick={() => (filter = k as MediaKind | '')}>{label}</button
					>
				{/each}
			</div>
		{/if}

		{#if failed}
			<p role="alert" class="text-small font-semibold text-danger">{failed}</p>
		{:else if loading && !items.length}
			<p class="text-small text-ink-2">Memuat…</p>
		{:else if shown.length}
			<MediaGrid items={shown} selected={chosen} onpick={toggle} />
		{:else}
			<EmptyState message="Belum ada media di sini. Unggah dulu di atas." />
		{/if}
	</div>

	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="button" class="btn btn--primary" disabled={!chosen.length} onclick={confirm}>
			Pilih{chosen.length > 1 ? ` (${chosen.length})` : ''}
		</button>
	{/snippet}
</Modal>
