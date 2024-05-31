import { TFile, TAbstractFile, TFolder, Vault, normalizePath } from 'obsidian'
import FlowPlugin from './main'

export async function addToNextActions(
	plugin: FlowPlugin,
	text: string,
	contexts: string[],
) {
	text = text.trim()
	let nextActionsFile = plugin.app.vault.getAbstractFileByPath(
		plugin.settings.nextActionsFilePath,
	) as TFile

	if (!nextActionsFile) {
		nextActionsFile = await plugin.app.vault.create(
			plugin.settings.nextActionsFilePath,
			'',
		)
	}

	const contextString = contexts
		.map((context) => `#context/${context}`)
		.join(' ')

	let content = await plugin.app.vault.read(nextActionsFile)
	content = content + '\n- [ ] ' + text

	if (contextString) {
		content = content + ' ' + contextString
	}
	if (plugin.settings.appendTask) {
		content = content + ' ' + plugin.settings.appendTask
	}
	content.concat('\n')

	await plugin.app.vault.modify(nextActionsFile, content)
}

export async function addToProject(
	plugin: FlowPlugin,
	projectFile: TFile,
	line: string,
) {
	line = line.trim()
	const fileContent = await plugin.app.vault.read(projectFile)

	const nextActionsIndex = fileContent.indexOf('## Next actions')

	let newContent = fileContent

	const taskLine = '\n- [ ] ' + line

	if (plugin.settings.appendTask) {
		taskLine.concat(' ' + plugin.settings.appendTask)
	}

	taskLine.concat('\n')

	if (nextActionsIndex !== -1) {
		const insertionIndex = nextActionsIndex + '## Next actions'.length + 1
		newContent =
			newContent.slice(0, insertionIndex) +
			taskLine +
			newContent.slice(insertionIndex)
	} else {
		newContent +=
			'\n## Next actions' + taskLine + ' ' + plugin.settings.appendTask
	}

	await plugin.app.vault.modify(projectFile, newContent)
}

export function readFileContent(
	plugin: FlowPlugin,
	file: TFile,
): Promise<string> {
	return plugin.app.vault.read(file)
}

export function writeFileContent(
	plugin: FlowPlugin,
	file: TFile,
	content: string,
): Promise<void> {
	return plugin.app.vault.modify(file, content)
}

export function getFilesWithTagPrefix(
	plugin: FlowPlugin,
	prefix: string,
): TFile[] {
	const { metadataCache, vault } = plugin.app
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

export function resolveTFolder(
	plugin: FlowPlugin,
	folder_str: string,
): TFolder {
	folder_str = normalizePath(folder_str)

	const folder = plugin.app.vault.getAbstractFileByPath(folder_str)
	if (!folder) {
		throw new Error(`Folder "${folder_str}" doesn't exist`)
	}
	if (!(folder instanceof TFolder)) {
		throw new Error(`${folder_str} is a file, not a folder`)
	}

	return folder
}

export function getTFilesFromFolder(
	plugin: FlowPlugin,
	folder_str: string,
): Array<TFile> {
	const folder = resolveTFolder(plugin, folder_str)

	const files: Array<TFile> = []
	Vault.recurseChildren(folder, (file: TAbstractFile) => {
		if (file instanceof TFile) {
			files.push(file)
		}
	})

	files.sort((a, b) => {
		return a.basename.localeCompare(b.basename)
	})

	return files
}
