<script>
	import ProcessingOptions from './ProcessingOptions.svelte'

	import { writable } from 'svelte/store'
	import { openFile, countLinesInFile, countFilesInFolder } from '../utils'

	export let plugin
	export let filePath
	export let folderPath
	let lineCount = writable(0)
	let fileCount = writable(0)

	export async function updateLineCount() {
		openFile(filePath, plugin).then((file) => {
			countLinesInFile(plugin, file).then((count) => {
				lineCount.set(count)
			})
		})
	}
	export async function updateFileCount() {
		countFilesInFolder(plugin, folderPath).then((count) => {
			fileCount.set(count)
		})
	}
</script>

<div>
	<p>Items to process in inbox: {$lineCount}</p>
	<p>Items to process from emails/Teams: {$fileCount}</p>
	<main>
		<ProcessingOptions />
	</main>
</div>
