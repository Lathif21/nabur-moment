<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CmsImage from '#lib/components/site/CmsImage.svelte';
	import { EVENT_TYPES } from '#lib/crm.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const intro = $derived(data.sections.intro);
	const image = $derived(
		typeof intro.data.image === 'string' ? (data.media[intro.data.image] as MediaItem) : undefined
	);
	const fields = $derived((form?.fields ?? {}) as Record<string, string>);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	// ?paket=<id> from "Pilih paket"; read in the browser because cached pages ignore the query
	const preselected = $derived(values.packageId ?? page.url.searchParams.get('paket') ?? '');
	let sending = $state(false);

	const err = (k: string) => fields[k];
	const describedBy = (k: string) => (fields[k] ? `${k}-error` : undefined);
</script>

<svelte:head>
	<title>Booking · {data.site.businessName}</title>
</svelte:head>

<section class="border-t border-sage section-pad">
	<div class="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
		<header class="flex flex-col gap-5">
			{#if intro.visible}
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<h1 class="font-display text-h1">{intro.data.headline}</h1>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html intro.data.body}</div>
				{#if image}
					<CmsImage
						media={image}
						sizes="(min-width: 64rem) 40vw, 90vw"
						class="mt-4 hidden aspect-4/5 w-full object-cover lg:block"
					/>
				{/if}
			{:else}
				<h1 class="font-display text-h1">Booking</h1>
			{/if}
		</header>

		<form
			method="post"
			class="flex flex-col gap-5"
			novalidate
			use:enhance={() => {
				sending = true;
				return async ({ update }) => {
					await update({ reset: false });
					sending = false;
				};
			}}
		>
			{#if form?.fields}
				<p role="alert" class="bg-danger-bg px-4 py-3 text-small font-semibold text-danger">
					Periksa lagi isian yang ditandai.
				</p>
			{/if}

			{#snippet text(
				name: string,
				label: string,
				opts: {
					type?: string;
					required?: boolean;
					autocomplete?: string;
					inputmode?: 'tel' | 'email' | 'text';
					hint?: string;
				} = {}
			)}
				<div class="flex flex-col gap-1.5">
					<label for="f-{name}" class="text-small font-semibold">
						{label}{#if opts.required}<span class="text-danger" aria-hidden="true"> *</span>{/if}
					</label>
					<input
						id="f-{name}"
						{name}
						type={opts.type ?? 'text'}
						class="input min-h-12! rounded-btn!"
						autocomplete={opts.autocomplete as never}
						inputmode={opts.inputmode}
						required={opts.required}
						aria-required={opts.required ? 'true' : undefined}
						aria-invalid={err(name) ? 'true' : undefined}
						aria-describedby={describedBy(name) ?? (opts.hint ? `${name}-hint` : undefined)}
						defaultValue={values[name] ?? ''}
					/>
					{#if err(name)}
						<p id="{name}-error" class="field__error">{err(name)}</p>
					{:else if opts.hint}
						<p id="{name}-hint" class="field__hint">{opts.hint}</p>
					{/if}
				</div>
			{/snippet}

			{@render text('name', 'Nama', { required: true, autocomplete: 'name' })}
			{@render text('phone', 'No. WhatsApp', {
				type: 'tel',
				required: true,
				autocomplete: 'tel',
				inputmode: 'tel',
				hint: 'Kami menghubungimu lewat nomor ini.'
			})}
			<div class="grid gap-5 sm:grid-cols-2">
				{@render text('email', 'Email', {
					type: 'email',
					autocomplete: 'email',
					inputmode: 'email'
				})}
				{@render text('instagram', 'Instagram', { hint: 'Contoh: @namakamu' })}
			</div>

			<div class="grid gap-5 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5">
					<label for="f-eventType" class="text-small font-semibold"
						>Jenis acara<span class="text-danger" aria-hidden="true"> *</span></label
					>
					<select
						id="f-eventType"
						name="eventType"
						class="input min-h-12! rounded-btn!"
						required
						aria-required="true"
						aria-invalid={err('eventType') ? 'true' : undefined}
						aria-describedby={describedBy('eventType')}
					>
						{#each EVENT_TYPES as e (e.key)}
							<option value={e.key} selected={(values.eventType ?? 'wedding') === e.key}
								>{e.label}</option
							>
						{/each}
					</select>
					{#if err('eventType')}<p id="eventType-error" class="field__error">
							{err('eventType')}
						</p>{/if}
				</div>
				{@render text('eventDate', 'Tanggal acara (utama)', { type: 'date' })}
			</div>
			<div class="grid gap-5 sm:grid-cols-2">
				{@render text('venue', 'Lokasi / venue')}
				{@render text('city', 'Kota', { autocomplete: 'address-level2' })}
			</div>

			<div class="grid gap-5 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5">
					<label for="f-packageId" class="text-small font-semibold">Paket yang diminati</label>
					<select id="f-packageId" name="packageId" class="input min-h-12! rounded-btn!">
						<option value="belum" selected={!preselected}>Belum tahu</option>
						{#each data.packages as p (p.id)}
							<option value={p.id} selected={preselected === p.id}>{p.name} · {p.category}</option>
						{/each}
					</select>
				</div>
				<div class="flex flex-col gap-1.5">
					<label for="f-sourceId" class="text-small font-semibold">Tahu kami dari mana</label>
					<select id="f-sourceId" name="sourceId" class="input min-h-12! rounded-btn!">
						<option value="">Pilih…</option>
						{#each data.sources as s (s.id)}
							<option value={s.id} selected={values.sourceId === s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="f-message" class="text-small font-semibold">Pesan</label>
				<textarea
					id="f-message"
					name="message"
					class="input min-h-32 rounded-btn!"
					maxlength="2000"
					aria-invalid={err('message') ? 'true' : undefined}
					defaultValue={values.message ?? ''}></textarea>
			</div>

			<!-- Honeypot: invisible to people and screen readers; bots fill it -->
			<div class="absolute -left-[9999px] size-px overflow-hidden" aria-hidden="true">
				<label for="f-website">Website</label>
				<input id="f-website" name="website" type="text" tabindex="-1" autocomplete="off" />
			</div>

			<button type="submit" class="site-btn mt-2 w-full sm:w-fit" disabled={sending}>
				{sending ? 'Mengirim…' : 'Kirim'}
			</button>
		</form>
	</div>
</section>
