<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Eye from '@lucide/svelte/icons/eye';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Send from '@lucide/svelte/icons/send';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import SectionCard, { type SaveState } from '#lib/components/cms/SectionCard.svelte';
	import { SITE_SETTINGS } from '#lib/cms/site-settings.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import { toast } from '#lib/toast.ts';
	import type { Path } from '$app/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let media = $state<Record<string, MediaItem>>({ ...data.media });
	let saveState = $state<SaveState>('idle');
	let publishing = $state(false);
	let revertOpen = $state(false);
	const busy = $derived(saveState === 'saving' || saveState === 'pending');
</script>

<div class="page-body">
	<PageHeader
		title="Pengaturan situs"
		description="Logo, kontak, media sosial, footer, dan SEO bawaan. Tampil di situs setelah Terbitkan."
	>
		{#snippet actions()}
			<a
				href={resolve('?preview=1' as Path)}
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
						disabled={busy || saveState === 'error' || publishing}
					>
						<Send size={16} aria-hidden="true" />
						{publishing ? 'Menerbitkan…' : busy ? 'Menyimpan…' : 'Terbitkan'}
					</button>
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	{#key data.version}
		<SectionCard
			saveUrl={resolve('admin/api/site-settings')}
			toggle={false}
			def={SITE_SETTINGS}
			initial={{ draft: data.settings.draft, draftVisible: true, dirty: data.settings.dirty }}
			{media}
			canEdit={data.canEdit}
			onstate={(_, s) => (saveState = s)}
		/>
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
	Perubahan pengaturan situs yang belum diterbitkan akan dibuang.
</ConfirmDialog>
