<script>
	import ProcessingOptions from './ProcessingOptions.svelte'
	import {
		lineCount,
		fileCount,
		stage,
		updateLineCount,
		updateFileCount,
		determineStage,
	} from '../state'

	export let plugin

	$: updateLineCount(plugin)
	$: updateFileCount(plugin)
	$: determineStage()
</script>

<div>
	<div class="process-inbox-header">GTD processing</div>
	<div class="process-inbox-info">
		<p>Items to process in inbox: {$lineCount}</p>
		<p>Items to process from emails/Teams: {$fileCount}</p>
		<p>Currently stage: {$stage}</p>
	</div>
	<div class="process-inbox-content"></div>

	<main>
		<ProcessingOptions />
	</main>
</div>
