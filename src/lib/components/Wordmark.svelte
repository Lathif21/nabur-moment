<script lang="ts">
	type Props = {
		/** Text colour; the logo is cream on forest or forest on cream */
		tone?: 'forest' | 'cream';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	};

	let { tone = 'forest', size = 'md', class: className }: Props = $props();
</script>

<!-- Typeset stand-in for the logo (ref/): "NABUR" in a wide-tracked serif, "MOMENT" in a light
     tracked sans. Replace with the SVG files once the brand vectors exist (06-DESIGN-SYSTEM → Brand). -->
<span
	class={[
		'inline-flex flex-col items-center leading-none select-none',
		tone === 'cream' ? 'text-cream' : 'text-forest',
		className
	]}
>
	<span
		class={[
			'font-display tracking-[0.32em]',
			size === 'sm' && 'text-lg',
			size === 'md' && 'text-2xl',
			size === 'lg' && 'text-5xl'
		]}
		style="margin-right: -0.32em">NABUR</span
	>
	<span
		class={[
			'font-sans font-normal tracking-[0.5em]',
			size === 'sm' && 'mt-1 text-[0.5rem]',
			size === 'md' && 'mt-1.5 text-[0.625rem]',
			size === 'lg' && 'mt-3 text-sm'
		]}
		style="margin-right: -0.5em">MOMENT</span
	>
</span>
