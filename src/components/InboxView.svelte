<script lang="ts">
	import { App, MarkdownRenderer, Component } from 'obsidian'
	import { Stage } from '../state'

	export let app: App

	export let lineCount: number
	export let fileCount: number

	export let line: string
	export let currentStage: Stage
	export let onAddToNextActions: (text: string) => void
	export let onAddToProjectNextActions: (text: string) => void
	export let onAddToProjectReference: (text: string) => void
	export let onAddToNewProject: (text: string) => void
	export let onTrash: () => void
	export let isProcessingComplete: false

	export let noteContent: string = ''
	export let sourcePath: string = ''
	export let noteContainer: HTMLDivElement
	export let parentComponent: Component

	$: renderMarkdown(noteContent)

	async function renderMarkdown(content: string) {
		if (noteContainer) {
			noteContainer.innerHTML = ''
			if (!content) {
				return
			}

			await MarkdownRenderer.render(
				app,
				content,
				noteContainer,
				sourcePath,
				parentComponent,
			)
		}
	}

	let inputText: string = currentStage === Stage.File ? line : ''
	$: if (currentStage === Stage.File) {
		inputText = line
	} else if (currentStage === Stage.Folder) {
		inputText = ''
	}

	function addToNextActions() {
		if (inputText.trim() !== '') onAddToNextActions(inputText)
	}

	function addToProjectNextActions() {
		if (inputText.trim() !== '') onAddToProjectNextActions(inputText)
	}
	function addToProjectReference() {
		if (inputText.trim() !== '') onAddToProjectReference(inputText)
	}

	function addToNewProject() {
		if (inputText.trim() !== '') onAddToNewProject(inputText)
	}

	function trash() {
		onTrash()
	}
</script>

{#if !isProcessingComplete}
	<div class="flow-status">
		<h2>Flow status</h2>
		<p>Stage: {currentStage}</p>
		<h3>Inbox counts</h3>
		<p>Lines to process: {lineCount}</p>
		<p>Files to process: {fileCount}</p>
	</div>
{/if}

<div class="flow-processing">
	{#if isProcessingComplete}
		<div>
			<h3>Processing Complete</h3>
			<p>All items have been processed.</p>
		</div>
	{:else}
		<textarea bind:value={inputText}></textarea>
		<button on:click={addToNextActions}>Add to Next Actions</button>
		<button on:click={addToProjectNextActions}
			>Add to Project (as action)</button
		>
		<button on:click={addToProjectReference}
			>Add to Project (as reference)</button
		>
		<button on:click={addToNewProject}
			>Add to New Project (as action)</button
		>
		<button on:click={trash}>Trash</button>
		<div>
			<h3>Currently processing:</h3>
			<p>{line}</p>
		</div>
		<div id="flow-note-container" bind:this={noteContainer}></div>
	{/if}
</div>
