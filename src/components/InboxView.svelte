<script lang="ts">
	export let line: string
	export let onAddToNextActions: (text: string) => void
	export let onAddToProject: (text: string) => void
	export let onTrash: () => void
	export let isProcessingComplete: false

	let inputText: string = line
	$: inputText = line

	function addToNextActions() {
		if (inputText.trim() !== '') onAddToNextActions(inputText)
	}

	function addToProject() {
		if (inputText.trim() !== '') onAddToProject(inputText)
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
		<button on:click={trash}>Trash</button>
		<div>
			<h3>Currently processing:</h3>
			<p>{line}</p>
		</div>
	{/if}
</div>
