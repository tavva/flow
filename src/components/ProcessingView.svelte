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
			<div class="flow-action-group">
				<span class="flow-action-group-title">Next action</span>
				<div class="flow-button-container">
					<button
						class="flow-next-action-general"
						on:click={addToNextActions}
						><span class="flow-icon flow-icon-next-action-general"
						></span>General</button
					>
					<button
						class="flow-project"
						on:click={addToProjectNextActions}
						><span class="flow-icon flow-icon-project"
						></span>Project</button
					>
					<button
						class="flow-person"
						on:click={addToPersonDiscussNext}
						><span class="flow-icon flow-icon-person"></span>Person
					</button>
				</div>
			</div>
			<div class="flow-action-group">
				<span class="flow-action-group-title">Reference</span>
				<div class="flow-button-container">
					<button
						class="flow-project"
						on:click={addToProjectReference}
						><span class="flow-icon flow-icon-project"
						></span>Project</button
					>
					<button class="flow-person" on:click={addToPersonReference}
						><span class="flow-icon flow-icon-person"></span>
						Person</button
					>
				</div>
			</div>
			<div class="flow-action-group">
				<span class="flow-action-group-title">Other</span>
				<div class="flow-button-container">
					<button class="flow-person" on:click={addToNewProject}
						><span class="flow-icon flow-icon-person"></span>
						New project</button
					>
					<button class="flow-trash" on:click={trash}
						><span class="flow-icon flow-icon-trash"
						></span>Delete</button
					>
				</div>
			</div>
		</div>
		{#if lineCount > 0}
			<div>
				<h3>Currently processing:</h3>
				<p>{line}</p>
			</div>
			<div class="flow-note-container" bind:this={noteContainer}></div>
		{/if}
	{/if}
</div>
