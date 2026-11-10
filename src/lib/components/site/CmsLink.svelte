<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAnchorAttributes, 'href' | 'children'> & {
		/** From the CMS: /internal, https://…, mailto:, tel: (validated on save) */
		href: string;
		children: Snippet;
	};

	let { href, children, ...rest }: Props = $props();
	const external = $derived(/^https:\/\//.test(href));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- CMS link, validated by linkSchema -->
<a
	{...rest}
	{href}
	target={external ? '_blank' : undefined}
	rel={external ? 'noopener noreferrer' : undefined}
	>{@render children()}{#if external}<span class="sr-only"> (tab baru)</span>{/if}</a
>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
