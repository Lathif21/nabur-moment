<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Check from '@lucide/svelte/icons/check';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import FieldInput from './FieldInput.svelte';
	import type { SectionDef } from '#lib/cms/sections.ts';
	import type { MediaItem } from '#lib/media/types.ts';

	export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

	type Props = {
		/** Autosave endpoint (PUT { data, visible }) */
		saveUrl: string;
		/** Show the Tampilkan switch (page sections); settings have none */
		toggle?: boolean;
		def: SectionDef;
		initial: { draft: Record<string, unknown>; draftVisible: boolean; dirty: boolean };
		media: Record<string, MediaItem>;
		canEdit: boolean;
		/** Reports the autosave state so the page can hold Terbitkan while saving */
		onstate: (key: string, state: SaveState) => void;
	};

	let { saveUrl, toggle = true, def, initial, media, canEdit, onstate }: Props = $props();

	// The editor owns the draft from here on; the page remounts the card after Terbitkan
	// svelte-ignore state_referenced_locally
	let data = $state(structuredClone(initial.draft));
	// svelte-ignore state_referenced_locally
	let visible = $state(initial.draftVisible);
	// svelte-ignore state_referenced_locally
	let dirty = $state(initial.dirty);
	let status = $state<SaveState>('idle');
	let error = $state('');

	const AUTOSAVE_MS = 900;
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Last body the server has; only the initial value is wanted here
	// svelte-ignore state_referenced_locally
	let last = JSON.stringify({ data: $state.snapshot(data), visible });

	function setStatus(s: SaveState) {
		status = s;
		onstate(def.key, s);
	}

	async function save() {
		const body = JSON.stringify({ data: $state.snapshot(data), visible });
		if (body === last) return setStatus(status === 'pending' ? 'saved' : status);
		setStatus('saving');
		try {
			const res = await fetch(saveUrl, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body
			});
			const out = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(out.message ?? `Gagal menyimpan (${res.status}).`);
			last = body;
			dirty = out.dirty;
			error = '';
			setStatus('saved');
		} catch (e) {
			error = (e as Error).message;
			setStatus('error');
		}
	}

	// Autosave a moment after the last change
	$effect(() => {
		const body = JSON.stringify({ data: $state.snapshot(data), visible });
		if (body === last || !canEdit) return;
		setStatus('pending');
		clearTimeout(timer);
		timer = setTimeout(save, AUTOSAVE_MS);
		return () => clearTimeout(timer);
	});
</script>

<section
	class={['card flex flex-col gap-4 p-5', !visible && 'opacity-75']}
	aria-labelledby="section-{def.key}"
>
	<header class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<h2
				id="section-{def.key}"
				class="flex flex-wrap items-center gap-2 font-display text-section-title"
			>
				{def.label}
				{#if dirty}<span class="chip chip--warning">Belum diterbitkan</span>{/if}
				{#if !visible}<span class="chip">Disembunyikan</span>{/if}
			</h2>
			{#if def.description}<p class="text-small text-ink-2">{def.description}</p>{/if}
		</div>
		<div class="flex items-center gap-3">
			<span class="flex items-center gap-1 text-[0.75rem] text-ink-2" aria-live="polite">
				{#if status === 'saving' || status === 'pending'}
					<LoaderCircle size={13} class="animate-spin" aria-hidden="true" /> Menyimpan…
				{:else if status === 'saved'}
					<Check size={13} class="text-success" aria-hidden="true" /> Tersimpan
				{:else if status === 'error'}
					<CircleAlert size={13} class="text-danger" aria-hidden="true" /> Gagal
				{/if}
			</span>
			{#if toggle}
				<label class="flex items-center gap-2 text-small">
					<input type="checkbox" class="checkbox" bind:checked={visible} disabled={!canEdit} />
					Tampilkan
				</label>
			{/if}
		</div>
	</header>

	{#if error}
		<p
			role="alert"
			class="rounded-card bg-danger-bg px-3 py-2 text-small font-semibold text-danger"
		>
			{error}
		</p>
	{/if}

	<div class="flex flex-col gap-4">
		{#each def.fields as f, i (f.key)}
			{#if f.group && f.group !== def.fields[i - 1]?.group}
				<h3
					class={[
						'text-small font-semibold tracking-wide text-ink-2 uppercase',
						i > 0 && 'mt-2 border-t border-line pt-4'
					]}
				>
					{f.group}
				</h3>
			{/if}
			<FieldInput
				field={f}
				bind:value={data[f.key]}
				{media}
				id="{def.key}-{f.key}"
				disabled={!canEdit}
			/>
		{/each}
	</div>
</section>
