<script lang="ts">
	import { MarkdownRenderer, Component } from 'obsidian'

	import FlowPlugin from 'main'
	import { Stage } from 'state'
	import { openPlanningView } from 'views/planning'

	export let plugin: FlowPlugin

	export let lineCount: number
	export let fileCount: number

	export let line: string
	export let currentStage: Stage
	export let onAddToNextActions: (text: string) => void
	export let onAddToProjectNextActions: (text: string) => void
	export let onAddToProjectReference: (text: string) => void
	export let onAddToPersonDiscussNext: (text: string) => void
	export let onAddToPersonReference: (text: string) => void
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
			noteContainer.empty()

			if (!content) {
				return
			}

			await MarkdownRenderer.render(
				plugin.app,
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

	function addToPersonDiscussNext() {
		if (inputText.trim() !== '') onAddToPersonDiscussNext(inputText)
	}
	function addToPersonReference() {
		if (inputText.trim() !== '') onAddToPersonReference(inputText)
	}

	function addToNewProject() {
		if (inputText.trim() !== '') onAddToNewProject(inputText)
	}

	async function startPlanning() {
		await openPlanningView(plugin)
	}

	function trash() {
		onTrash()
	}
</script>

{#if !isProcessingComplete}
	<div class="flow-status">
		<p>Remaining: Lines: {lineCount} | Files: {fileCount}</p>
	</div>
{/if}

<div class="flow-processing">
	{#if isProcessingComplete}
		<div>
			<h3>Processing complete</h3>
			<p>All items have been processed.</p>
			<button on:click={startPlanning}>Plan your day?</button>
		</div>
	{:else}
		<textarea bind:value={inputText}></textarea>
		<div class="flow-processing-actions">
			<div>
				<button on:click={addToNextActions}>Add as a next action</button
				>
			</div>
			<div>
				<span>Project:</span>
				<button on:click={addToNewProject}
					>Create new and add next action</button
				>
				<button on:click={addToProjectNextActions}
					>Add as next action</button
				>
				<button on:click={addToProjectReference}
					>Add as reference</button
				>
			</div>
			<div>
				<span>Person:</span>
				<button on:click={addToPersonDiscussNext}
					>Add as next action</button
				>
				<button on:click={addToPersonReference}>Add as reference</button
				>
			</div>
		{#if lineCount > 0}
			<div>
				<button on:click={trash}>Trash</button>
				<h3>Currently processing:</h3>
				<p>{line}</p>
			</div>
			<div class="flow-note-container" bind:this={noteContainer}></div>
		{/if}
	{/if}
</div>
