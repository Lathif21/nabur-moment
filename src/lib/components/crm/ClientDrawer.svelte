<script module lang="ts">
	export type ClientValues = {
		id: string;
		name: string;
		phone: string | null;
		email: string | null;
		instagram: string | null;
		city: string | null;
		sourceId: string | null;
		notes: string | null;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import { phoneDisplay } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		open: boolean;
		/** null = new client */
		client: ClientValues | null;
		sources: { id: string; name: string; archived: boolean }[];
		/** Form action: "?/create" or "?/update" (on whichever page hosts the drawer) */
		action: string;
		/** After a successful save; gets the client id */
		onsaved?: (id: string) => void;
	};

	let { open = $bindable(), client, sources, action, onsaved }: Props = $props();

	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	const formId = $derived(client ? `client-edit-${client.id}` : 'client-new');
	const err = (k: string) => (errors[k] ? [errors[k]] : undefined);

	// Clear old errors whenever the drawer opens for another client
	$effect(() => {
		if (open) errors = {};
	});
</script>

<!-- Create / edit a client (03-SCREENS B5). WhatsApp is stored as 628…, Instagram without @. -->
<Drawer
	bind:open
	title={client ? 'Ubah klien' : 'Tambah klien'}
	description={client ? client.name : 'Orang yang memesan. Satu klien bisa punya beberapa booking.'}
>
	{#key client?.id ?? 'new'}
		<form
			id={formId}
			method="post"
			{action}
			novalidate
			class="flex flex-col gap-4"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') {
						errors = (result.data?.fields ?? {}) as Record<string, string>;
						if (result.data?.error) toast.error(String(result.data.error));
						return;
					}
					if (result.type !== 'success') return;
					await update({ navigate: false, reset: false });
					open = false;
					toast.success(String(result.data?.done));
					onsaved?.(String(result.data?.id ?? ''));
				};
			}}
		>
			{#if client}<input type="hidden" name="id" value={client.id} />{/if}
			<Field label="Nama" name="name" required errors={err('name')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						autocomplete="off"
						maxlength="120"
						defaultValue={client?.name ?? ''}
					/>
				{/snippet}
			</Field>
			<Field
				label="WhatsApp"
				name="phone"
				hint="Contoh 0812-3456-7890. Disimpan sebagai 62…"
				errors={err('phone')}
			>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						type="tel"
						inputmode="tel"
						autocomplete="off"
						maxlength="30"
						defaultValue={client?.phone ? phoneDisplay(client.phone) : ''}
					/>
				{/snippet}
			</Field>
			<Field label="Email" name="email" errors={err('email')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						type="email"
						autocomplete="off"
						maxlength="200"
						defaultValue={client?.email ?? ''}
					/>
				{/snippet}
			</Field>
			<Field label="Instagram" name="instagram" hint="Username tanpa @" errors={err('instagram')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						autocomplete="off"
						maxlength="60"
						defaultValue={client?.instagram ?? ''}
					/>
				{/snippet}
			</Field>
			<Field label="Kota" name="city" errors={err('city')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						autocomplete="off"
						maxlength="80"
						defaultValue={client?.city ?? ''}
					/>
				{/snippet}
			</Field>
			<Field label="Sumber" name="sourceId" errors={err('sourceId')}>
				{#snippet children(attrs)}
					<select {...attrs} class="input" value={client?.sourceId ?? ''}>
						<option value="">Belum diketahui</option>
						{#each sources as s (s.id)}
							<option value={s.id}>{s.name}{s.archived ? ' (diarsipkan)' : ''}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Catatan" name="notes" errors={err('notes')}>
				{#snippet children(attrs)}
					<textarea
						{...attrs}
						class="input min-h-24"
						maxlength="2000"
						defaultValue={client?.notes ?? ''}></textarea>
				{/snippet}
			</Field>
		</form>
	{/key}
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="submit" form={formId} class="btn btn--primary" disabled={busy}>
			{busy ? 'Menyimpan…' : client ? 'Simpan' : 'Tambah klien'}
		</button>
	{/snippet}
</Drawer>
