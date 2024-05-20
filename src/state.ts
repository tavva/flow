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
}

export async function updateFileCount(plugin: any) {
	const folderPath = plugin.settings.incomingEmailFolderPath
	const count = await countFilesInFolder(plugin, folderPath)
	fileCount.set(count)
}

export function updateStage(currentStage: ProcessStage) {
	console.log('Setting stage to:', currentStage)
	stage.set(currentStage)
}

export async function determineStage() {
	console.log('We are determining stage...')
	let currentLineCount: number
	let currentFileCount: number

	lineCount.subscribe((value) => (currentLineCount = value))()
	fileCount.subscribe((value) => (currentFileCount = value))()

	if (currentLineCount > 0) {
		updateStage(ProcessStage.Inbox)
	} else if (currentFileCount > 0) {
		updateStage(ProcessStage.Email)
	} else {
		updateStage(ProcessStage.Done)
	}
}
