<script lang="ts">
	export let line: string
	let inputText: string = line

	function addToNextActions() {}

	function addToProject() {}

	function trash() {}
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
