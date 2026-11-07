<script lang="ts">
	import { resolve } from '$app/paths';
	import PencilLine from '@lucide/svelte/icons/pencil-line';
	import PageHeader from '#lib/components/admin/PageHeader.svelte';
	import { dateID } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<div class="page-body">
	<PageHeader
		title="Halaman"
		description="Isi setiap halaman situs. Perubahan tersimpan sebagai draf sampai Anda menekan Terbitkan."
	/>

	<section class="card table-wrap" aria-label="Daftar halaman">
		<table class="table min-w-[36rem]">
			<thead>
				<tr>
					<th scope="col">Halaman</th>
					<th scope="col">Status</th>
					<th scope="col">Terakhir terbit</th>
					<th scope="col"><span class="sr-only">Aksi</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.pages as p (p.key)}
					<tr>
						<td>
							<a
								class="font-semibold underline-offset-4 hover:underline"
								href={resolve('/admin/(app)/konten/halaman/[page]', { page: p.key })}>{p.label}</a
							>
							<span class="block text-small text-ink-2">/{p.path} · {p.sections} bagian</span>
						</td>
						<td>
							{#if p.dirty}<span class="chip chip--warning">Draf berubah</span>{:else}<span
									class="chip chip--success">Terbit</span
								>{/if}
						</td>
						<td class="text-small whitespace-nowrap">
							{p.publishedAt ? dateID(p.publishedAt, 'datetime') : '–'}
						</td>
						<td class="text-right">
							<a
								class="btn btn--secondary btn--sm"
								href={resolve('/admin/(app)/konten/halaman/[page]', { page: p.key })}
							>
								<PencilLine size={14} aria-hidden="true" /> Ubah
							</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
</div>
