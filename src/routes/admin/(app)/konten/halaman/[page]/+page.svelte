<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Eye from '@lucide/svelte/icons/eye';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import SectionCard, { type SaveState } from '#lib/components/cms/SectionCard.svelte';
	import { PAGE_BY_KEY } from '#lib/cms/sections.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import { toast } from '#lib/toast.ts';
	import type { Path } from '$app/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const def = $derived(PAGE_BY_KEY.get(data.pageKey)!);
	// Media the editor knows about; pickers add to it
	// svelte-ignore state_referenced_locally
	let media = $state<Record<string, MediaItem>>({ ...data.media });
	let states = $state<Record<string, SaveState>>({});
	let publishing = $state(false);
	let revertOpen = $state(false);

	const busy = $derived(Object.values(states).some((s) => s === 'saving' || s === 'pending'));
	const failed = $derived(Object.values(states).some((s) => s === 'error'));
</script>

<div class="page-body">
	<a
		href={resolve('admin/konten/halaman')}
		class="inline-flex min-h-10 w-fit items-center gap-1.5 text-small font-semibold text-olive underline-offset-4 hover:underline"
	>
		<ArrowLeft size={15} aria-hidden="true" /> Semua halaman
	</a>

	<PageHeader
		title={data.title}
		description="Perubahan tersimpan otomatis sebagai draf. Pengunjung baru melihatnya setelah Terbitkan."
	>
		{#snippet actions()}
			<!-- Registry paths are public routes (siteNav / bookingHref) -->
			<a
				href={resolve(`${def.path}?preview=1` as Path)}
				target="_blank"
				rel="noopener"
				class="btn btn--secondary"
			>
				<Eye size={16} aria-hidden="true" /> Pratinjau <span class="sr-only">(tab baru)</span>
			</a>
			{#if data.canEdit}
				<button type="button" class="btn btn--ghost" onclick={() => (revertOpen = true)}>
					<RotateCcw size={16} aria-hidden="true" /> Kembalikan
				</button>
				<form
					method="post"
					action="?/publish"
					use:enhance={() => {
						publishing = true;
						return async ({ result, update }) => {
							await update({ reset: false });
							publishing = false;
							if (result.type === 'success') toast.success(String(result.data?.done));
							if (result.type === 'failure') toast.error(String(result.data?.error));
						};
					}}
				>
					<button
						type="submit"
						class="btn btn--primary"
						disabled={busy || failed || publishing}
						title={busy
							? 'Tunggu draf selesai disimpan'
							: failed
								? 'Ada bagian yang gagal disimpan'
								: undefined}
					>
						<Send size={16} aria-hidden="true" />
						{publishing ? 'Menerbitkan…' : busy ? 'Menyimpan…' : 'Terbitkan'}
					</button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	{#key data.version}
		<div class="flex flex-col gap-4">
			{#each def.sections as s (s.key)}
				{@const initial = data.sections.find((x) => x.key === s.key)!}
				<SectionCard
					page={data.pageKey}
					def={s}
					{initial}
					{media}
					canEdit={data.canEdit}
					onstate={(key, state) => (states[key] = state)}
				/>
			{/each}
		</div>
	{/key}
</div>

<ConfirmDialog
	bind:open={revertOpen}
	title="Kembalikan ke versi terbit?"
	action="?/revert"
	fields={{}}
	confirmLabel="Kembalikan"
	tone="danger"
>
	Semua perubahan draf di halaman <strong>{data.title}</strong> yang belum diterbitkan akan dibuang.
</ConfirmDialog>
