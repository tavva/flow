<script lang="ts">
	import { Stage } from '../state'

	export let line: string
	export let currentStage: Stage
	export let onAddToNextActions: (text: string) => void
	export let onAddToProject: (text: string) => void
	export let onAddToNewProject: (text: string) => void
	export let onTrash: () => void
	export let isProcessingComplete: false

	let inputText: string = currentStage === Stage.Inbox ? line : ''
	$: if (currentStage === Stage.Inbox) {
		inputText = line
	} else if (currentStage === Stage.EmailInbox) {
		inputText = ''
	}

	function addToNextActions() {
		if (inputText.trim() !== '') onAddToNextActions(inputText)
	}

	function addToProject() {
		if (inputText.trim() !== '') onAddToProject(inputText)
	}

	function addToNewProject() {
		if (inputText.trim() !== '') onAddToNewProject(inputText)
	}

	function trash() {
		onTrash()
	}
</script>

<div class="flow-processing">
	{#if isProcessingComplete}
		<div>
			<h3>Processing Complete</h3>
			<p>All items have been processed.</p>
		</div>
	{:else}
		<textarea bind:value={inputText}></textarea>
		<button on:click={addToNextActions}>Add to Next Actions</button>
		<button on:click={addToProject}>Add to Project</button>
		<button on:click={addToNewProject}>Add to New Project</button>
		<button on:click={trash}>Trash</button>
		<div>
			<h3>Currently processing:</h3>
			<p>{line}</p>
		</div>
	{/if}
</div>
