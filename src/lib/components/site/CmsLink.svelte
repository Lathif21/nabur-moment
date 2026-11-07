<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** From the CMS: /internal, https://…, mailto:, tel: (validated on save) */
		href: string;
		class?: string;
		children: Snippet;
	};

	let { href, class: className, children }: Props = $props();
	const external = $derived(/^https:\/\//.test(href));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- CMS link, validated by linkSchema -->
<a
	{href}
	class={className}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	>{@render children()}{#if external}<span class="sr-only"> (tab baru)</span>{/if}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
