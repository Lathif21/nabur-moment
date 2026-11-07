<script lang="ts">
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Bold from '@lucide/svelte/icons/bold';
	import Italic from '@lucide/svelte/icons/italic';
	import LinkIcon from '@lucide/svelte/icons/link';
	import Unlink from '@lucide/svelte/icons/unlink';
	import { onMount } from 'svelte';

	type Props = {
		/** Sanitised HTML (p, br, strong, em, a) */
		value: string;
		id: string;
		label: string;
		disabled?: boolean;
	};

	let { value = $bindable(), id, label, disabled = false }: Props = $props();

	let element = $state<HTMLDivElement>();
	let editor = $state<Editor>();
	// Bumped on every editor transaction so toolbar states re-render
	let tick = $state(0);
	let linkOpen = $state(false);
	let linkUrl = $state('');

	onMount(() => {
		editor = new Editor({
			element: element!,
			editable: !disabled,
			// Only what the site renders: paragraphs, line breaks, bold, italic, links
			extensions: [
				StarterKit.configure({
					heading: false,
					blockquote: false,
					bulletList: false,
					orderedList: false,
					listItem: false,
					listKeymap: false,
					code: false,
					codeBlock: false,
					horizontalRule: false,
					strike: false,
					underline: false,
					link: { openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] }
				})
			],
			content: value,
			editorProps: {
				attributes: {
					id,
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': label,
					class: 'rich-text input min-h-28 focus:outline-none'
				}
			},
			onTransaction: () => tick++,
			onUpdate: ({ editor }) => {
				value = editor.isEmpty ? '' : editor.getHTML();
			}
		});
		return () => editor?.destroy();
	});

	function active(name: string) {
		void tick; // re-evaluate after every editor transaction
		return editor?.isActive(name) ?? false;
	}

	function applyLink() {
		const url = linkUrl.trim();
		if (!editor) return;
		if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		linkOpen = false;
		linkUrl = '';
	}
</script>

<div class="flex flex-col gap-1.5">
	{#if !disabled}
		<div class="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Format {label}">
			<button
				type="button"
				class={['icon-btn size-8!', active('bold') && 'bg-sage-20']}
				aria-label="Tebal"
				aria-pressed={active('bold')}
				onclick={() => editor?.chain().focus().toggleBold().run()}
			>
				<Bold size={15} aria-hidden="true" />
			</button>
			<button
				type="button"
				class={['icon-btn size-8!', active('italic') && 'bg-sage-20']}
				aria-label="Miring"
				aria-pressed={active('italic')}
				onclick={() => editor?.chain().focus().toggleItalic().run()}
			>
				<Italic size={15} aria-hidden="true" />
			</button>
			<button
				type="button"
				class={['icon-btn size-8!', active('link') && 'bg-sage-20']}
				aria-label="Tautan"
				aria-expanded={linkOpen}
				onclick={() => {
					linkUrl = editor?.getAttributes('link').href ?? '';
					linkOpen = !linkOpen;
				}}
			>
				<LinkIcon size={15} aria-hidden="true" />
			</button>
			{#if active('link')}
				<button
					type="button"
					class="icon-btn size-8!"
					aria-label="Hapus tautan"
					onclick={() => editor?.chain().focus().unsetLink().run()}
				>
					<Unlink size={15} aria-hidden="true" />
				</button>
			{/if}
		</div>
		{#if linkOpen}
			<div class="flex gap-2">
				<input
					class="input min-h-9! py-1!"
					type="url"
					placeholder="https://… atau mailto:…"
					aria-label="Alamat tautan"
					bind:value={linkUrl}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							applyLink();
						}
					}}
				/>
				<button type="button" class="btn btn--secondary btn--sm" onclick={applyLink}>Pasang</button>
			</div>
		{/if}
	{/if}
	<div bind:this={element}></div>
</div>

<style>
	:global(.rich-text p + p) {
		margin-top: 0.75em;
	}
	:global(.rich-text a) {
		color: var(--color-olive);
		text-decoration: underline;
	}
	:global(.rich-text strong) {
		font-weight: 700;
	}
</style>
