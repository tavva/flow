<script>
	import ProcessingOptions from './ProcessingOptions.svelte'
	import {
		lineCount,
		fileCount,
		stage,
		nextStage,
		updateLineCount,
		updateFileCount,
	} from '../state'

	export let plugin

	$: updateLineCount(plugin)
	$: updateFileCount(plugin)

	function moveToNextStage() {
		stage.set($nextStage)
	}
</script>

<div>
	<div class="process-inbox-header">GTD processing</div>
	<div class="process-inbox-info">
		<p>Items to process in inbox: {$lineCount}</p>
		<p>Items to process from emails/Teams: {$fileCount}</p>
		<p>Current stage: {$stage}</p>
		<p>Next stage: {$nextStage}</p>
		{#if $stage !== $nextStage}
			<button on:click={moveToNextStage}>Move to next stage</button>
		{/if}
	</div>
	<div class="process-inbox-content"></div>

	<main>
		<ProcessingOptions />
	</main>
</div>
