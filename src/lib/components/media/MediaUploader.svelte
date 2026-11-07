<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Upload from '@lucide/svelte/icons/upload';
	import { ACCEPT, uploadFile } from '#lib/media/upload.ts';
	import { fileSize, type MediaItem } from '#lib/media/types.ts';

	type Props = {
		/** After each file is ready in the library */
		onuploaded?: (item: MediaItem) => void;
		/** Smaller drop zone inside the picker */
		compact?: boolean;
	};

	let { onuploaded, compact = false }: Props = $props();

	type Job = {
		id: number;
		file: File;
		status: 'waiting' | 'working' | 'done' | 'error';
		loaded: number;
		total: number;
		error?: string;
	};

	let jobs = $state<Job[]>([]);
	let dragging = $state(false);
	let running = false;
	let seq = 0;
	let input = $state<HTMLInputElement>();

	const base = resolve('admin/api/media');

	function add(files: FileList | File[]) {
		for (const file of files)
			jobs.push({ id: ++seq, file, status: 'waiting', loaded: 0, total: file.size });
		void run();
	}

	/** One at a time: big videos on a phone connection should not compete */
	async function run() {
		if (running) return;
		running = true;
		try {
			for (let job = next(); job; job = next()) {
				job.status = 'working';
				job.error = undefined;
				try {
					const item = await uploadFile(job.file, base, (p) => {
						job.loaded = p.loaded;
						job.total = p.total;
					});
					job.status = 'done';
					onuploaded?.(item);
				} catch (e) {
					job.status = 'error';
					job.error = (e as Error).message;
				}
			}
		} finally {
			running = false;
		}
	}

	const next = () => jobs.find((j) => j.status === 'waiting');

	function retry(job: Job) {
		job.status = 'waiting';
		job.loaded = 0;
		void run();
	}

	const pct = (j: Job) => (j.total ? Math.min(100, Math.round((j.loaded / j.total) * 100)) : 0);
	const finished = $derived(jobs.length > 0 && jobs.every((j) => j.status === 'done'));
</script>

<div class="flex flex-col gap-3">
	<div
		role="presentation"
		class={[
			'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed text-center transition-colors',
			compact ? 'px-4 py-4' : 'px-6 py-8',
			dragging ? 'border-olive bg-sage-20' : 'border-line bg-surface'
		]}
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			if (e.dataTransfer?.files.length) add(e.dataTransfer.files);
		}}
	>
		{#if !compact}<Upload size={24} strokeWidth={1.5} class="text-olive" aria-hidden="true" />{/if}
		<p class="text-small text-ink-2">
			Seret foto atau video MP4 ke sini, atau
			<button
				type="button"
				class="font-semibold text-forest underline underline-offset-2"
				onclick={() => input?.click()}>pilih file</button
			>.
			{#if !compact}<br />Foto diperkecil otomatis ke WebP. Video MP4 diunggah apa adanya.{/if}
		</p>
		<input
			bind:this={input}
			type="file"
			multiple
			accept={ACCEPT}
			class="sr-only"
			aria-label="Pilih file untuk diunggah"
			onchange={(e) => {
				const files = e.currentTarget.files;
				if (files?.length) add([...files]);
				e.currentTarget.value = '';
			}}
		/>
	</div>

	{#if jobs.length}
		<ul class="flex flex-col gap-2" aria-label="Unggahan">
			{#each jobs as job (job.id)}
				<li class="flex items-center gap-3 rounded-card border border-line bg-surface px-3 py-2">
					<div class="min-w-0 flex-1">
						<p class="flex items-baseline gap-2 text-small">
							<span class="truncate font-semibold">{job.file.name}</span>
							<span class="shrink-0 text-ink-2">{fileSize(job.file.size)}</span>
						</p>
						{#if job.status === 'error'}
							<p class="text-[0.75rem] font-semibold text-danger">{job.error}</p>
						{:else}
							<div
								class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sage-20"
								role="progressbar"
								aria-label="Progres {job.file.name}"
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={job.status === 'done' ? 100 : pct(job)}
							>
								<div
									class="h-full bg-olive transition-[width]"
									style:width="{job.status === 'done' ? 100 : pct(job)}%"
								></div>
							</div>
						{/if}
					</div>
					{#if job.status === 'done'}
						<CircleCheck size={18} class="shrink-0 text-success" aria-label="Selesai" />
					{:else if job.status === 'error'}
						<CircleAlert size={18} class="shrink-0 text-danger" aria-hidden="true" />
						<button
							type="button"
							class="btn btn--secondary btn--sm"
							onclick={() => retry(job)}
							aria-label="Coba lagi {job.file.name}"
						>
							<RotateCcw size={14} aria-hidden="true" /> Coba lagi
						</button>
					{:else}
						<span class="shrink-0 text-[0.75rem] text-ink-2 tabular-nums"
							>{job.status === 'waiting' ? 'Menunggu' : `${pct(job)}%`}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
		{#if finished}
			<button
				type="button"
				class="w-fit text-small text-olive underline underline-offset-2"
				onclick={() => (jobs = [])}>Bersihkan daftar</button
			>
		{/if}
	{/if}
</div>
