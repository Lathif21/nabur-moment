<script lang="ts">
	import { Toaster } from 'svelte-sonner';
</script>

<!-- Mounted once in the root layout. Call `toast` from '#lib/toast.ts'. -->
<Toaster
	position="bottom-right"
	closeButton
	toastOptions={{
		unstyled: true,
		classes: {
			toast:
				'flex w-[356px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-card border border-line bg-surface p-4 font-sans text-body text-ink shadow-modal',
			title: 'font-semibold',
			description: 'text-small text-ink-2',
			success: 'border-l-4 border-l-success [&_[data-icon]]:text-success',
			error: 'border-l-4 border-l-danger [&_[data-icon]]:text-danger',
			warning: 'border-l-4 border-l-warning [&_[data-icon]]:text-warning',
			info: 'border-l-4 border-l-olive [&_[data-icon]]:text-olive',
			actionButton: 'btn btn--primary btn--sm ml-auto',
			cancelButton: 'btn btn--secondary btn--sm',
			closeButton: 'icon-btn order-last ml-auto size-7! shrink-0'
		}
	}}
/>
