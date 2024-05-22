<script lang="ts">
	export let line: string
	export let onAddToNextActions: (text: string) => void
	export let onAddToProject: (text: string) => void
	export let onTrash: () => void
	let inputText: string = line

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

<div>
	<div>
		<h3>Current Line:</h3>
		<p>{line}</p>
	</div>
	<textarea bind:value={inputText}></textarea>
	<button on:click={addToNextActions}>Add to Next Actions</button>
	<button on:click={addToProject}>Add to Project</button>
	<button on:click={trash}>Trash</button>
</div>
