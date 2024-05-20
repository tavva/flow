import { writable } from 'svelte/store'
import { ProcessStage } from './process'
import { openFile, countLinesInFile, countFilesInFolder } from './utils'

export const lineCount = writable(0)
export const fileCount = writable(0)
export const stage = writable(ProcessStage.Inbox)

export async function updateLineCount(plugin: any) {
	const filePath = plugin.settings.inboxFilePath
	const file = await openFile(filePath, plugin)
	const count = await countLinesInFile(plugin, file)
	lineCount.set(count)
	determineStage()
}

export async function updateFileCount(plugin: any) {
	const folderPath = plugin.settings.incomingEmailFolderPath
	const count = await countFilesInFolder(plugin, folderPath)
	fileCount.set(count)
	determineStage()
}

export async function determineStage() {
	let currentLineCount: number
	let currentFileCount: number

	lineCount.subscribe((value) => (currentLineCount = value))()
	fileCount.subscribe((value) => (currentFileCount = value))()

	if (currentLineCount > 0) {
		stage.set(ProcessStage.Inbox)
	} else if (currentFileCount > 0) {
		stage.set(ProcessStage.Email)
	} else {
		stage.set(ProcessStage.Done)
	}
}
