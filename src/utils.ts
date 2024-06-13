import { TFile, TAbstractFile, TFolder, Vault, normalizePath } from 'obsidian'
import FlowPlugin from './main'

// TODO:
// We can make all of this a bit more generic, by adding an action or reference
// info to any section of any file, rather than specifying person or project,
// etc.

export async function addToNextActions(
	plugin: FlowPlugin,
	text: string,
	spheres: string[],
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

	const sphereString = spheres.map((sphere) => `#sphere/${sphere}`).join(' ')

	let content = await plugin.app.vault.read(nextActionsFile)
	content = content + '\n- [ ] ' + text

	if (sphereString) {
		content = content + ' ' + sphereString
	}
	if (plugin.settings.appendTask) {
		content = content + ' ' + plugin.settings.appendTask
	}
	content.concat('\n')

	await plugin.app.vault.modify(nextActionsFile, content)
}

async function addToFileSection(
	plugin: FlowPlugin,
	projectFile: TFile,
	line: string,
	sectionName: string,
	isTask: boolean = false,
) {
	// TODO: use an options map for the function arguments

	line = line.trim()
	const fileContent = await plugin.app.vault.read(projectFile)

	const nextActionsIndex = fileContent.indexOf(sectionName)

	let newContent = fileContent

	const taskLine = `\n${isTask ? '- [ ] ' : '- '}${line}`

	if (plugin.settings.appendTask) {
		taskLine.concat(' ' + plugin.settings.appendTask)
	}

	taskLine.concat('\n')

	if (nextActionsIndex !== -1) {
		const insertionIndex = nextActionsIndex + sectionName.length + 1
		newContent =
			newContent.slice(0, insertionIndex) +
			taskLine +
			newContent.slice(insertionIndex)
	} else {
		newContent +=
			'\n' + sectionName + taskLine + ' ' + plugin.settings.appendTask
	}

	await plugin.app.vault.modify(projectFile, newContent)
}

export async function addToProjectNextActions(
	plugin: FlowPlugin,
	projectFile: TFile,
	line: string,
) {
	await addToFileSection(
		plugin,
		projectFile,
		line,
		'## Next actions',
		true, // isTask
	)
}

export async function addToProjectReference(
	plugin: FlowPlugin,
	projectFile: TFile,
	line: string,
) {
	// TODO: make the section name a setting
	await addToFileSection(plugin, projectFile, line, '## Notes + resources')
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
	const metadataCache = plugin.app.metadataCache
	const vault = plugin.app.vault
	const files = vault.getFiles()

	return files.filter((file) => {
		if (
			file.path.startsWith(
				// @ts-ignore
				plugin.app.plugins.plugins['templater-obsidian'].settings
					.template_folder,
			)
		) {
			return false
		}

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

export async function getProjectFilePath(
	plugin: FlowPlugin,
	projectName: string,
): Promise<string> {
	const projectFiles = getFilesWithTagPrefix(plugin, 'project')
	const projectFile = projectFiles.find(
		(file) => file.name === `${projectName}.md`,
	)

	if (projectFile) {
		return projectFile.path
	} else {
		return ''
	}
}
