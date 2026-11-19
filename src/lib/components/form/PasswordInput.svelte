<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import type { HTMLInputAttributes } from 'svelte/elements';

	// Password input with a show / hide toggle. Spread Field's `attrs` onto it like a plain input.
	let props: Omit<HTMLInputAttributes, 'type'> = $props();
	let visible = $state(false);
</script>

<div class="relative">
	<input {...props} class="input pr-11" type={visible ? 'text' : 'password'} />
	<button
		type="button"
		class="icon-btn absolute inset-y-0 right-0 my-auto text-ink-2"
		aria-label="Tampilkan sandi"
		aria-pressed={visible}
		aria-controls={props.id}
		onclick={() => (visible = !visible)}
	>
		{#if visible}<EyeOff size={18} aria-hidden="true" />{:else}<Eye
				size={18}
				aria-hidden="true"
			/>{/if}
	</button>
</div>
