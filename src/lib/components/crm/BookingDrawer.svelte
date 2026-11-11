<script module lang="ts">
	export type BookingFormOptions = {
		packages: { id: string; name: string; price: number; visible: boolean; category: string }[];
		addons: { id: string; name: string; price: number }[];
		clients: { id: string; name: string; phone: string | null }[];
		crew: { id: string; name: string; role: string; active: boolean }[];
	};

	/** One event is handled by 1 or 2 crew (services/crew.ts MAX_CREW_PER_BOOKING) */
	const MAX_CREW = 2;
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Combobox } from 'bits-ui';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import Drawer from '#lib/components/admin/Drawer.svelte';
	import Field from '#lib/components/form/Field.svelte';
	import MoneyInput from '#lib/components/form/MoneyInput.svelte';
	import { STAGES, bookingEventTypes, crewMatches, type EventType } from '#lib/crm.ts';
	import { dateID, phoneDisplay, rupiah } from '#lib/format.ts';
	import { toast } from '#lib/toast.ts';

	type Props = {
		open: boolean;
		/** null = new booking */
		bookingId: string | null;
		options: BookingFormOptions;
		/** The person may create a client inline (clients:create) */
		allowNewClient: boolean;
		/** Form action on the hosting page: "?/create" / "?/update" are picked from bookingId */
		onsaved?: (id: string) => void;
	};

	let { open = $bindable(), bookingId, options, allowNewClient, onsaved }: Props = $props();

	type SessionRow = {
		key: number;
		eventType: EventType;
		date: string;
		startTime: string;
		endTime: string;
		venue: string;
		city: string;
	};
	type AddonRow = {
		key: number;
		addonId: string | null;
		name: string;
		unitPrice: number | null;
		qty: number;
	};

	let rowKey = 0;
	const newSession = (eventType: EventType = 'akad'): SessionRow => ({
		key: ++rowKey,
		eventType,
		date: '',
		startTime: '',
		endTime: '',
		venue: '',
		city: ''
	});

	// ---------- form state ----------
	let loading = $state(false);
	let busy = $state(false);
	let errors = $state<Record<string, string>>({});
	let clientMode = $state<'existing' | 'new'>('existing');
	let clientId = $state<string | null>(null);
	let clientLabel = $state('');
	let clientQuery = $state('');
	let newClientName = $state('');
	let newClientPhone = $state('');
	let title = $state('');
	let eventType = $state<EventType>('wedding');
	let stage = $state<'inquiry' | 'consultation' | 'quotation'>('inquiry');
	let packageId = $state('');
	let sessions = $state<SessionRow[]>([newSession()]);
	let addons = $state<AddonRow[]>([]);
	let agreedPrice = $state<number | null>(0);
	let notes = $state('');
	let crewIds = $state<string[]>([]);
	/** Crew already on the saved booking: shown even when deactivated since */
	let savedCrew = $state<string[]>([]);
	/** Package of the saved booking and its snapshot price (site price changes don't apply) */
	let savedPackage = $state<{ id: string | null; price: number | null }>({ id: null, price: null });
	let sameDate = $state<Record<string, { id: string; title: string }[]>>({});

	const err = (k: string) => (errors[k] ? [errors[k]] : undefined);
	const isEdit = $derived(!!bookingId);
	const formId = $derived(isEdit ? `booking-edit-${bookingId}` : 'booking-new');

	function reset() {
		errors = {};
		clientMode = 'existing';
		clientId = null;
		clientLabel = '';
		clientQuery = '';
		newClientName = '';
		newClientPhone = '';
		title = '';
		eventType = 'wedding';
		stage = 'inquiry';
		packageId = '';
		sessions = [newSession()];
		addons = [];
		agreedPrice = 0;
		notes = '';
		crewIds = [];
		savedCrew = [];
		savedPackage = { id: null, price: null };
		sameDate = {};
	}

	async function loadBooking(id: string) {
		loading = true;
		try {
			const res = await fetch(`/admin/api/bookings/${id}`);
			if (!res.ok) throw new Error();
			const b = await res.json();
			clientId = b.clientId;
			clientLabel = b.clientName;
			title = b.title;
			eventType = b.eventType;
			packageId = b.packageId ?? '';
			savedPackage = { id: b.packageId, price: b.packageSnapshot?.price ?? null };
			sessions = b.sessions.length
				? b.sessions.map((s: Record<string, string | null>) => ({
						key: ++rowKey,
						eventType: s.eventType as EventType,
						date: s.date ?? '',
						startTime: s.startTime ?? '',
						endTime: s.endTime ?? '',
						venue: s.venue ?? '',
						city: s.city ?? ''
					}))
				: [newSession()];
			addons = b.addons.map((a: AddonRow) => ({ ...a, key: ++rowKey }));
			agreedPrice = b.agreedPrice;
			notes = b.notes ?? '';
			crewIds = b.crewIds ?? [];
			savedCrew = [...crewIds];
		} catch {
			toast.error('Booking tidak bisa dimuat.');
			open = false;
		} finally {
			loading = false;
		}
	}

	// Fill the form each time the drawer opens
	$effect(() => {
		if (!open) return;
		reset();
		if (bookingId) void loadBooking(bookingId);
	});

	// ---------- client picker ----------
	const clientMatches = $derived.by(() => {
		const q = clientQuery.trim().toLowerCase();
		if (!q) return [];
		const digits = q.replace(/\D/g, '').replace(/^(62|0)/, '');
		return options.clients
			.filter(
				(c) =>
					c.name.toLowerCase().includes(q) ||
					(digits.length >= 3 && (c.phone ?? '').includes(digits))
			)
			.slice(0, 8);
	});

	function pickClient(c: { id: string; name: string }) {
		clientId = c.id;
		clientLabel = c.name;
		clientQuery = '';
	}

	// ---------- price = package + add-ons (editable; recalculated when either changes) ----------
	const packagePrice = $derived.by(() => {
		if (!packageId) return 0;
		if (packageId === savedPackage.id && savedPackage.price !== null) return savedPackage.price;
		return options.packages.find((p) => p.id === packageId)?.price ?? 0;
	});
	const addonsTotal = $derived(
		addons.reduce((sum, a) => sum + (a.unitPrice ?? 0) * Math.max(1, a.qty || 1), 0)
	);
	const computed = $derived(packagePrice + addonsTotal);
	const recompute = () => (agreedPrice = packagePrice + addonsTotal);

	function addAddon(id: string) {
		if (id === 'custom') {
			addons.push({ key: ++rowKey, addonId: null, name: '', unitPrice: 0, qty: 1 });
		} else {
			const a = options.addons.find((x) => x.id === id);
			if (a)
				addons.push({ key: ++rowKey, addonId: a.id, name: a.name, unitPrice: a.price, qty: 1 });
		}
		queueMicrotask(recompute);
	}

	// ---------- same-date warning (D13: allowed, never blocked) ----------
	let sameTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const dates = sessions.map((s) => s.date).filter(Boolean);
		const except = bookingId;
		clearTimeout(sameTimer);
		if (!open || !dates.length) {
			sameDate = {};
			return;
		}
		sameTimer = setTimeout(async () => {
			const qs = [
				...dates.map((d) => `d=${encodeURIComponent(d)}`),
				...(except ? [`except=${encodeURIComponent(except)}`] : [])
			].join('&');
			try {
				const res = await fetch(`/admin/api/bookings/same-date?${qs}`);
				if (res.ok) sameDate = await res.json();
			} catch {
				// the warning is a convenience; the save still works
			}
		}, 300);
	});

	// ---------- crew (0–2): searchable multi-select, scales to dozens of crew ----------
	const crewChoices = $derived(options.crew.filter((c) => c.active || savedCrew.includes(c.id)));
	let crewQuery = $state('');
	let crewOpen = $state(false);
	const crewFiltered = $derived(
		crewChoices.filter((c) => crewMatches({ ...c, phone: null }, crewQuery))
	);
	const crewSelected = $derived(
		crewIds.map((id) => options.crew.find((c) => c.id === id)).filter((c) => !!c)
	);
	const removeCrew = (id: string) => (crewIds = crewIds.filter((x) => x !== id));

	const sessionsJson = $derived(
		JSON.stringify(
			sessions.map(({ eventType, date, startTime, endTime, venue, city }) => ({
				eventType,
				date,
				startTime,
				endTime,
				venue,
				city
			}))
		)
	);
	const addonsJson = $derived(
		JSON.stringify(
			addons.map(({ addonId, name, unitPrice, qty }) => ({
				addonId,
				name,
				unitPrice: unitPrice ?? 0,
				qty: Math.max(1, Number(qty) || 1)
			}))
		)
	);
</script>

<!-- New / edit booking (03-SCREENS B4). Stage changes go through the board, not this form. -->
<Drawer
	bind:open
	title={isEdit ? 'Ubah booking' : 'Booking baru'}
	description={isEdit ? title : 'Satu booking = satu acara, bisa beberapa sesi.'}
>
	{#if loading}
		<p class="text-body text-ink-2" role="status">Memuat…</p>
	{:else}
		<form
			id={formId}
			method="post"
			action={isEdit ? '?/update' : '?/create'}
			novalidate
			class="flex flex-col gap-5"
			use:enhance={() => {
				busy = true;
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'failure') {
						errors = (result.data?.fields ?? {}) as Record<string, string>;
						toast.error(String(result.data?.error ?? 'Periksa lagi isian yang ditandai merah.'));
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
			{#if isEdit}<input type="hidden" name="id" value={bookingId} />{/if}
			<input type="hidden" name="sessions" value={sessionsJson} />
			<input type="hidden" name="addons" value={addonsJson} />
			<input type="hidden" name="crewIds" value={JSON.stringify(crewIds)} />

			<!-- Client -->
			<fieldset class="flex flex-col gap-3">
				<legend class="mb-1 font-semibold">Klien</legend>
				{#if clientMode === 'existing'}
					<input type="hidden" name="clientId" value={clientId ?? ''} />
					{#if clientId}
						<div
							class="flex items-center justify-between gap-2 rounded-card border border-line bg-sage-20 px-3 py-2"
						>
							<span class="font-semibold">{clientLabel}</span>
							<button
								type="button"
								class="icon-btn"
								aria-label="Ganti klien"
								onclick={() => {
									clientId = null;
									clientLabel = '';
								}}
							>
								<X size={16} aria-hidden="true" />
							</button>
						</div>
					{:else}
						<div class="field">
							<label for="booking-client-search">Cari klien</label>
							<input
								id="booking-client-search"
								class="input"
								type="search"
								autocomplete="off"
								placeholder="Nama atau nomor WhatsApp"
								bind:value={clientQuery}
								aria-invalid={errors.clientId ? 'true' : undefined}
								aria-describedby={errors.clientId ? 'booking-client-error' : undefined}
							/>
							{#if errors.clientId}<p id="booking-client-error" class="field__error">
									{errors.clientId}
								</p>{/if}
						</div>
						{#if clientMatches.length}
							<ul class="card divide-y divide-line" aria-label="Hasil pencarian klien">
								{#each clientMatches as c (c.id)}
									<li>
										<button
											type="button"
											class="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left hover:bg-sage-20"
											onclick={() => pickClient(c)}
										>
											<span class="font-semibold">{c.name}</span>
											{#if c.phone}<span class="text-small text-ink-2">{phoneDisplay(c.phone)}</span
												>{/if}
										</button>
									</li>
								{/each}
							</ul>
						{:else if clientQuery.trim()}
							<p class="text-small text-ink-2">Tidak ada klien yang cocok.</p>
						{/if}
					{/if}
					{#if allowNewClient && !clientId}
						<button
							type="button"
							class="btn btn--ghost btn--sm self-start"
							onclick={() => {
								clientMode = 'new';
								newClientName = clientQuery.trim();
							}}
						>
							<Plus size={14} aria-hidden="true" /> Klien baru
						</button>
					{/if}
				{:else}
					<Field label="Nama klien" name="newClientName" required errors={err('newClientName')}>
						{#snippet children(attrs)}
							<input {...attrs} class="input" maxlength="120" bind:value={newClientName} />
						{/snippet}
					</Field>
					<Field
						label="WhatsApp"
						name="newClientPhone"
						hint="Dicek agar tidak ada klien ganda"
						errors={err('newClientPhone')}
					>
						{#snippet children(attrs)}
							<input
								{...attrs}
								class="input"
								type="tel"
								inputmode="tel"
								maxlength="30"
								bind:value={newClientPhone}
							/>
						{/snippet}
					</Field>
					<button
						type="button"
						class="btn btn--ghost btn--sm self-start"
						onclick={() => (clientMode = 'existing')}>Pilih klien yang sudah ada</button
					>
				{/if}
			</fieldset>

			<!-- Event -->
			<Field label="Judul" name="title" required errors={err('title')}>
				{#snippet children(attrs)}
					<input
						{...attrs}
						class="input"
						maxlength="160"
						placeholder="Wedding Nadia & Raka"
						bind:value={title}
					/>
				{/snippet}
			</Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Jenis acara" name="eventType" required errors={err('eventType')}>
					{#snippet children(attrs)}
						<select {...attrs} class="input" bind:value={eventType}>
							{#each bookingEventTypes(eventType) as t (t.key)}<option value={t.key}
									>{t.label}</option
								>{/each}
						</select>
					{/snippet}
				</Field>
				{#if !isEdit}
					<Field label="Tahap awal" name="stage" hint="Booked setelah DP dicatat">
						{#snippet children(attrs)}
							<select {...attrs} class="input" bind:value={stage}>
								{#each STAGES.slice(0, 3) as s (s.key)}<option value={s.key}>{s.label}</option
									>{/each}
							</select>
						{/snippet}
					</Field>
				{/if}
			</div>

			<!-- Sessions -->
			<fieldset class="flex flex-col gap-3">
				<legend class="mb-1 font-semibold">Sesi</legend>
				{#if errors.sessions}<p class="field__error">{errors.sessions}</p>{/if}
				{#each sessions as s, i (s.key)}
					{@const others = s.date ? (sameDate[s.date] ?? []) : []}
					<div class="flex flex-col gap-3 rounded-card border border-line p-3">
						<div class="flex items-center justify-between gap-2">
							<span class="text-small font-semibold text-ink-2">Sesi {i + 1}</span>
							{#if sessions.length > 1}
								<button
									type="button"
									class="icon-btn"
									aria-label="Hapus sesi {i + 1}"
									onclick={() => sessions.splice(i, 1)}
								>
									<Trash2 size={16} aria-hidden="true" />
								</button>
							{/if}
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<div class="field">
								<label for="s{s.key}-type">Jenis sesi</label>
								<select id="s{s.key}-type" class="input" bind:value={s.eventType}>
									{#each bookingEventTypes(s.eventType) as t (t.key)}<option value={t.key}
											>{t.label}</option
										>{/each}
								</select>
							</div>
							<div class="field">
								<label for="s{s.key}-date">Tanggal</label>
								<input
									id="s{s.key}-date"
									class="input"
									type="date"
									bind:value={s.date}
									aria-invalid={errors[`sessions.${i}.date`] ? 'true' : undefined}
								/>
							</div>
							<div class="field">
								<label for="s{s.key}-start">Jam mulai</label>
								<input id="s{s.key}-start" class="input" type="time" bind:value={s.startTime} />
							</div>
							<div class="field">
								<label for="s{s.key}-end">Jam selesai</label>
								<input
									id="s{s.key}-end"
									class="input"
									type="time"
									bind:value={s.endTime}
									aria-invalid={errors[`sessions.${i}.endTime`] ? 'true' : undefined}
									aria-describedby={errors[`sessions.${i}.endTime`]
										? `s${s.key}-end-error`
										: undefined}
								/>
								{#if errors[`sessions.${i}.endTime`]}<p
										id="s{s.key}-end-error"
										class="field__error"
									>
										{errors[`sessions.${i}.endTime`]}
									</p>{/if}
							</div>
							<div class="field">
								<label for="s{s.key}-venue">Venue</label>
								<input id="s{s.key}-venue" class="input" maxlength="200" bind:value={s.venue} />
							</div>
							<div class="field">
								<label for="s{s.key}-city">Kota</label>
								<input id="s{s.key}-city" class="input" maxlength="80" bind:value={s.city} />
							</div>
						</div>
						{#if others.length}
							<p
								class="flex items-start gap-2 rounded-card bg-warning-bg px-3 py-2 text-small text-warning"
								role="status"
							>
								<TriangleAlert size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
								<span
									>Sudah ada booking di tanggal ini ({dateID(s.date)}): {others
										.map((o) => o.title)
										.join(', ')}</span
								>
							</p>
						{/if}
					</div>
				{/each}
				<button
					type="button"
					class="btn btn--secondary btn--sm self-start"
					onclick={() => sessions.push(newSession(sessions.length ? 'resepsi' : 'akad'))}
				>
					<Plus size={14} aria-hidden="true" /> Tambah sesi
				</button>
			</fieldset>

			<!-- Crew -->
			<div class="field">
				<label for="booking-crew-search">Kru</label>
				{#if crewChoices.length}
					<Combobox.Root
						type="multiple"
						bind:value={crewIds}
						bind:open={crewOpen}
						inputValue={crewQuery}
						onValueChange={() => (crewQuery = '')}
						onOpenChange={(o) => {
							if (!o) crewQuery = '';
						}}
					>
						<div class="relative">
							<Search
								size={16}
								class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-2"
								aria-hidden="true"
							/>
							<Combobox.Input
								id="booking-crew-search"
								class="input pr-11 pl-9"
								autocomplete="off"
								placeholder={crewIds.length >= MAX_CREW
									? `Sudah ${MAX_CREW} kru, hapus satu untuk mengganti`
									: 'Cari nama atau peran kru'}
								oninput={(e) => {
									crewQuery = e.currentTarget.value;
									crewOpen = true; // bits-ui opens on keydown only; paste and autofill too
								}}
								aria-invalid={errors.crewIds ? 'true' : undefined}
								aria-describedby="booking-crew-hint{errors.crewIds ? ' booking-crew-error' : ''}"
							/>
							<Combobox.Trigger
								class="icon-btn absolute top-1/2 right-1 -translate-y-1/2"
								aria-label="Tampilkan daftar kru"
							>
								<ChevronsUpDown size={16} aria-hidden="true" />
							</Combobox.Trigger>
						</div>
						<Combobox.Portal>
							<Combobox.Content
								sideOffset={4}
								class="z-50 w-(--bits-combobox-anchor-width) rounded-card border border-line bg-surface shadow-modal"
							>
								<Combobox.Viewport class="max-h-64 overflow-y-auto p-1">
									{#each crewFiltered as c (c.id)}
										{@const full = !crewIds.includes(c.id) && crewIds.length >= MAX_CREW}
										<Combobox.Item
											value={c.id}
											label={c.name}
											disabled={full}
											aria-disabled={full ? 'true' : undefined}
											class="flex min-h-10 cursor-pointer items-center gap-2 rounded-card px-2 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-sage-20"
										>
											{#snippet children({ selected })}
												<span class="flex size-4 shrink-0 items-center justify-center">
													{#if selected}<Check size={16} aria-hidden="true" />{/if}
												</span>
												<span
													>{c.name}{#if c.role}<span class="text-ink-2">
															· {c.role}</span
														>{/if}{#if !c.active}<span class="text-ink-2">
															(nonaktif)</span
														>{/if}</span
												>
											{/snippet}
										</Combobox.Item>
									{:else}
										<p class="px-2 py-2 text-small text-ink-2">Tidak ada kru yang cocok.</p>
									{/each}
								</Combobox.Viewport>
							</Combobox.Content>
						</Combobox.Portal>
					</Combobox.Root>
					{#if crewSelected.length}
						<ul class="flex flex-wrap gap-2" aria-label="Kru dipilih">
							{#each crewSelected as c (c.id)}
								<li class="chip min-h-8 pr-1 text-body">
									{c.name}{#if c.role}<span class="font-normal text-ink-2">· {c.role}</span>{/if}
									<button
										type="button"
										class="inline-flex size-6 items-center justify-center rounded-full hover:bg-surface"
										aria-label="Hapus {c.name} dari kru"
										onclick={() => removeCrew(c.id)}
									>
										<X size={14} aria-hidden="true" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
				<p id="booking-crew-hint" class="field__hint">
					{#if crewChoices.length}
						Maksimal {MAX_CREW} kru per acara.{#if crewIds.length}
							Dipilih {crewIds.length}.{/if}
					{:else}
						Belum ada kru. Tambahkan di <a class="underline" href={resolve('admin/kru')}>Kru</a>.
					{/if}
				</p>
				{#if errors.crewIds}<p id="booking-crew-error" class="field__error">
						{errors.crewIds}
					</p>{/if}
			</div>

			<!-- Package + add-ons + price -->
			<Field label="Paket" name="packageId" errors={err('packageId')}>
				{#snippet children(attrs)}
					<select
						{...attrs}
						class="input"
						bind:value={packageId}
						onchange={() => queueMicrotask(recompute)}
					>
						<option value="">Tanpa paket</option>
						{#each options.packages as p (p.id)}
							<option value={p.id}
								>{p.category} · {p.name} · {rupiah(p.price)}{p.visible
									? ''
									: ' (tersembunyi)'}</option
							>
						{/each}
					</select>
				{/snippet}
			</Field>
			{#if !options.packages.length}
				<p class="-mt-3 text-small text-ink-2">
					Belum ada paket. Tambahkan di <a class="underline" href={resolve('admin/konten/paket')}
						>Konten → Paket</a
					>.
				</p>
			{/if}

			<fieldset class="flex flex-col gap-2">
				<legend class="mb-1 font-semibold">Add-on</legend>
				{#if errors.addons}<p class="field__error">{errors.addons}</p>{/if}
				{#each addons as a, i (a.key)}
					<div
						class="grid grid-cols-[1fr_auto] gap-2 rounded-card border border-line p-3 sm:grid-cols-[1fr_9rem_4.5rem_auto]"
					>
						<div class="field">
							<label for="a{a.key}-name">Nama</label>
							<input
								id="a{a.key}-name"
								class="input"
								maxlength="120"
								bind:value={a.name}
								readonly={!!a.addonId}
								aria-invalid={errors[`addons.${i}.name`] ? 'true' : undefined}
							/>
						</div>
						<div class="field max-sm:order-3">
							<label for="a{a.key}-price">Harga satuan</label>
							<MoneyInput
								id="a{a.key}-price"
								name="_addon_price_{a.key}"
								bind:value={a.unitPrice}
								oninput={() => queueMicrotask(recompute)}
							/>
						</div>
						<div class="field max-sm:order-4">
							<label for="a{a.key}-qty">Jumlah</label>
							<input
								id="a{a.key}-qty"
								class="input"
								type="number"
								min="1"
								max="99"
								bind:value={a.qty}
								oninput={() => queueMicrotask(recompute)}
							/>
						</div>
						<button
							type="button"
							class="icon-btn self-end max-sm:order-2"
							aria-label="Hapus add-on {a.name || i + 1}"
							onclick={() => {
								addons.splice(i, 1);
								queueMicrotask(recompute);
							}}
						>
							<Trash2 size={16} aria-hidden="true" />
						</button>
					</div>
				{/each}
				<div class="field">
					<label for="booking-add-addon" class="sr-only">Tambah add-on</label>
					<select
						id="booking-add-addon"
						class="input"
						value=""
						onchange={(e) => {
							const v = e.currentTarget.value;
							e.currentTarget.value = '';
							if (v) addAddon(v);
						}}
					>
						<option value="">+ Tambah add-on…</option>
						{#each options.addons as a (a.id)}<option value={a.id}
								>{a.name} · {rupiah(a.price)}</option
							>{/each}
						<option value="custom">Baris lain (ketik sendiri)</option>
					</select>
				</div>
			</fieldset>

			<div class="field">
				<label for="booking-price">Harga disepakati</label>
				<MoneyInput
					id="booking-price"
					name="agreedPrice"
					bind:value={agreedPrice}
					aria-invalid={errors.agreedPrice ? 'true' : undefined}
				/>
				<p class="field__hint">
					Paket + add-on = {rupiah(computed)}{#if (agreedPrice ?? 0) !== computed}
						· <button type="button" class="underline" onclick={recompute}>pakai angka ini</button
						>{/if}. Tanpa diskon.
				</p>
				{#if errors.agreedPrice}<p class="field__error">{errors.agreedPrice}</p>{/if}
			</div>

			<Field label="Catatan" name="notes" errors={err('notes')}>
				{#snippet children(attrs)}
					<textarea {...attrs} class="input min-h-20" maxlength="4000" bind:value={notes}
					></textarea>
				{/snippet}
			</Field>
		</form>
	{/if}
	{#snippet footer()}
		<button type="button" class="btn btn--secondary" onclick={() => (open = false)}>Batal</button>
		<button type="submit" form={formId} class="btn btn--primary" disabled={busy || loading}>
			{busy ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Buat booking'}
		</button>
	{/snippet}
</Drawer>
