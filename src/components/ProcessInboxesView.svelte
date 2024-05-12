<script>
	import { writable } from 'svelte/store'
	import { openFile, countLinesInFile } from '../utils'

	export let plugin
	export let filePath
	let lineCount = writable(0)

	export async function updateLineCount() {
		openFile(filePath, plugin).then((file) => {
			countLinesInFile(plugin, file).then((count) => {
				lineCount.set(count)
			})
		})
	}
</script>

<div>
	<p>Inbox file: {filePath}</p>
	<p>Lines in inbox: {$lineCount}</p>
</div>
