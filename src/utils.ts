import { App, TFile } from 'obsidian'

export async function openFile(
	filePath: string,
	plugin: GTDPlugin,
): Promise<TFile | null> {
	try {
		const file = plugin.app.vault.getAbstractFileByPath(filePath)
		if (file && file instanceof TFile) {
			return file
		} else {
			console.error(`File not found: ${filePath}`)
			return null
		}
	} catch (e) {
		console.error(`Failed to read file: ${filePath}`, e)
		return null
	}
}

export function getFilesWithTagPrefix(app: App, prefix: string): TFile[] {
	const { metadataCache, vault } = app
	const files = vault.getFiles()

	return files.filter((file) => {
		const cache = metadataCache.getFileCache(file)
		if (!cache || !cache.frontmatter) {
			return false
		}

		let tags: string[] = []
		if (Array.isArray(cache.frontmatter.tags)) {
			tags = cache.frontmatter.tags
		} else if (typeof cache.frontmatter.tags === 'string') {
			tags = cache.frontmatter.tags.split(/\s+/)
		}

		return tags.some((tag) => tag.startsWith(prefix))
	})
}

export async function countLinesInFile(
	plugin: GTDPlugin,
	file: TFile,
): Promise<number> {
	const fileContent = await plugin.app.vault.read(file)
	const lines = fileContent
		.split(/\r?\n/)
		.filter((line) => line.trim() !== '')
	return lines.length
}

export async function countFilesInFolder(
	plugin: GTDPlugin,
	folderPath: string,
): Promise<number> {
	const allFiles = plugin.app.vault.getFiles()
	const filesInFolder = allFiles.filter(
		(file) => file.path.startsWith(folderPath) && file.extension === 'md',
	)
	return filesInFolder.length
}
