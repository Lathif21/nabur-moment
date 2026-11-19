<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import CmsImage from '#lib/components/site/CmsImage.svelte';
	import PageHero from '#lib/components/site/sections/PageHero.svelte';
	import { EVENT_TYPES } from '#lib/crm.ts';
	import type { MediaItem } from '#lib/media/types.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const hero = $derived(data.sections.hero);
	const intro = $derived(data.sections.intro);
	/** Form labels from the CMS "Formulir" card */
	const t = $derived(data.sections.form.data as Record<string, string>);
	const m = (id: unknown): MediaItem | undefined =>
		typeof id === 'string' ? data.media[id] : undefined;
	const image = $derived(m(intro.data.image));
	const fields = $derived((form?.fields ?? {}) as Record<string, string>);
	const values = $derived((form?.values ?? {}) as Record<string, string>);
	// Ticked before a failed submit, else ?paket=<id>[,<id>] from "Pilih paket" (read in the
	// browser because cached pages ignore the query)
	const preselected = $derived.by(() => {
		const sent = (form?.values as { packageIds?: unknown } | undefined)?.packageIds;
		if (Array.isArray(sent)) return new Set(sent.map(String));
		return new Set((page.url.searchParams.get('paket') ?? '').split(',').filter(Boolean));
	});
	/** Published packages grouped by category, in site order */
	const packageGroups = $derived.by(() => {
		const groups: { category: string; packages: typeof data.packages }[] = [];
		for (const p of data.packages) {
			const last = groups.at(-1);
			if (last?.category === p.category) last.packages.push(p);
			else groups.push({ category: p.category, packages: [p] });
		}
		return groups;
	});
	let sending = $state(false);

	const err = (k: string) => fields[k];
	const describedBy = (k: string) => (fields[k] ? `${k}-error` : undefined);
</script>

{#if hero.visible}
	<PageHero
		title={hero.data.title as string}
		image={m(hero.data.image)}
		eyebrow={hero.data.eyebrow as string}
	/>
{/if}

<section class={['section-pad', !hero.visible && 'border-t border-sage']}>
	<div class="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
		<header class="flex flex-col gap-5">
			{#if intro.visible}
				{#if intro.data.eyebrow}<p class="eyebrow text-olive">{intro.data.eyebrow}</p>{/if}
				<svelte:element this={hero.visible ? 'h2' : 'h1'} class="font-display text-h1"
					>{intro.data.headline}</svelte:element
				>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised on save (cms-pages.ts) -->
				<div class="prose-site text-lead">{@html intro.data.body}</div>
				{#if image}
					<CmsImage
						media={image}
						sizes="(min-width: 64rem) 40vw, 90vw"
						class="mt-4 hidden aspect-4/5 w-full object-cover lg:block"
					/>
				{/if}
			{:else if !hero.visible}
				<h1 class="sr-only">{data.meta.title}</h1>
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
					{t.errorText}
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

			{@render text('name', t.nameLabel, { required: true, autocomplete: 'name' })}
			{@render text('phone', t.phoneLabel, {
				type: 'tel',
				required: true,
				autocomplete: 'tel',
				inputmode: 'tel',
				hint: t.phoneHint
			})}
			<div class="grid gap-5 sm:grid-cols-2">
				{@render text('email', t.emailLabel, {
					type: 'email',
					autocomplete: 'email',
					inputmode: 'email'
				})}
				{@render text('instagram', t.instagramLabel, { hint: t.instagramHint })}
			</div>

			<div class="grid gap-5 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5">
					<label for="f-eventType" class="text-small font-semibold"
						>{t.eventTypeLabel}<span class="text-danger" aria-hidden="true"> *</span></label
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
				{@render text('eventDate', t.eventDateLabel, { type: 'date' })}
			</div>
			<div class="grid gap-5 sm:grid-cols-2">
				{@render text('venue', t.venueLabel)}
				{@render text('city', t.cityLabel, { autocomplete: 'address-level2' })}
			</div>

			{#if data.packages.length}
				<fieldset
					class="flex flex-col gap-3"
					aria-describedby={t.packageHint ? 'packageIds-hint' : undefined}
				>
					<legend class="text-small font-semibold">{t.packageLabel}</legend>
					{#if t.packageHint}<p id="packageIds-hint" class="field__hint -mt-1.5">
							{t.packageHint}
						</p>{/if}
					<!-- Keyed by the first package: two categories may share a name -->
					{#each packageGroups as g (g.packages[0].id)}
						<div class="flex flex-col gap-1">
							{#if packageGroups.length > 1}<p class="text-small text-ink-2">{g.category}</p>{/if}
							<div class="grid gap-x-5 sm:grid-cols-2">
								{#each g.packages as p (p.id)}
									<label class="flex min-h-11 cursor-pointer items-center gap-3">
										<input
											type="checkbox"
											class="checkbox shrink-0"
											name="packageIds"
											value={p.id}
											checked={preselected.has(p.id)}
										/>
										<span>{p.name}</span>
									</label>
								{/each}
							</div>
						</div>
					{/each}
				</fieldset>
			{/if}

			<div class="grid gap-5 sm:grid-cols-2">
				<div class="flex flex-col gap-1.5">
					<label for="f-sourceId" class="text-small font-semibold">{t.sourceLabel}</label>
					<select id="f-sourceId" name="sourceId" class="input min-h-12! rounded-btn!">
						<option value="">{t.sourcePlaceholder}</option>
						{#each data.sources as s (s.id)}
							<option value={s.id} selected={values.sourceId === s.id}>{s.name}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex flex-col gap-1.5">
				<label for="f-message" class="text-small font-semibold">{t.messageLabel}</label>
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
				{sending ? t.sendingLabel : t.submitLabel}
			</button>
		</form>
	</div>
</section>
