<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import { isActive, visibleAdminNav } from '#lib/nav.ts';

	type Props = {
		/** The logged-in user, shown above "Keluar" */
		user: { name: string; email: string };
		/** The user's permission set; menus they cannot read are hidden */
		perms: string[];
		/** Called after a link is followed (closes the phone menu) */
		onnavigate?: () => void;
	};

	let { user, perms, onnavigate }: Props = $props();

	const groups = $derived(visibleAdminNav(perms));
</script>

<!-- Sidebar content, shared by the desktop column and the phone menu. Filtered by permission. -->
<div class="flex h-full flex-col bg-forest text-cream">
	<div class="flex justify-center px-5 pt-7 pb-6">
		<Wordmark tone="cream" size="sm" />
	</div>

	<nav aria-label="Menu admin" class="flex-1 overflow-y-auto px-3 pb-4">
		{#each groups as group, i (group.label ?? i)}
			<div class={['flex flex-col gap-0.5', i > 0 && 'mt-5']}>
				{#if group.label}
					<p class="px-3 pb-1.5 eyebrow text-[0.6875rem] text-cream/75">{group.label}</p>
				{/if}
				{#each group.items as item (item.href)}
					{@const active = isActive(item.href, page.url.pathname)}
					<a
						href={resolve(item.href)}
						aria-current={active ? 'page' : undefined}
						onclick={() => onnavigate?.()}
						class={[
							'flex min-h-10 items-center gap-3 rounded-card px-3 text-body transition-colors',
							active
								? 'bg-olive font-semibold text-cream'
								: 'text-cream/90 hover:bg-forest-90 hover:text-cream'
						]}
					>
						<item.icon size={18} strokeWidth={1.75} aria-hidden="true" />
						{item.label}
					</a>
				{/each}
			</div>
		{/each}
	</nav>

	<div class="border-t border-cream/15 px-3 py-3">
		<a
			href={resolve('')}
			target="_blank"
			rel="noopener"
			class="flex min-h-10 items-center gap-3 rounded-card px-3 text-body text-cream/90 hover:bg-forest-90 hover:text-cream"
		>
			<ExternalLink size={18} strokeWidth={1.75} aria-hidden="true" />
			Lihat situs
			<span class="sr-only">(tab baru)</span>
		</a>
		<div class="mt-2 flex items-center gap-2 border-t border-cream/15 pt-3 pl-3">
			<div class="min-w-0 flex-1">
				<p class="truncate text-small font-semibold">{user.name}</p>
				<p class="truncate text-[0.75rem] text-cream/75">{user.email}</p>
			</div>
			<form method="post" action={resolve('admin/logout')}>
				<button
					type="submit"
					class="icon-btn text-cream hover:bg-forest-90"
					aria-label="Keluar"
					title="Keluar"
				>
					<LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
				</button>
			</form>
		</div>
	</div>
</div>
