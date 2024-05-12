<script>
	let nextActionText = ''
	let isDisabled = true

	// Simulated methods for demonstration
	function addToProject(text) {
		// Logic to add to project
		console.log(`Add to Project: ${text}`)
	}

	function addToNextActions(text) {
		// Logic to add to next actions
		console.log(`Add to Next Actions: ${text}`)
	}

	function deleteFile() {
		// Logic to delete the file
		console.log('Delete the file')
	}
</script>

<div class="processing-options" class:disabled={isDisabled}>
	<input
		class="next-action-input"
		type="text"
		bind:value={nextActionText}
		placeholder="Enter next action text..."
	/>

	<button on:click={() => addToProject(nextActionText)}>Add to Project</button
	>
	<button on:click={() => addToNextActions(nextActionText)}
		>Add to Next Actions</button
	>
	<button on:click={deleteFile}>Delete</button>
</div>
