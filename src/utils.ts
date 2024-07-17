import { TFile, TAbstractFile, TFolder, Vault, normalizePath } from 'obsidian'

import FlowPlugin from 'main'
import type { TemplaterPlugin, Module } from 'typings/templater'

// TODO: Move the add* functions out to their own utils file
async function addLineToFile(
	plugin: FlowPlugin,
	text: string,
	filePath: string,
	spheres: string[],
) {
	text = text.trim()
	let file = plugin.app.vault.getAbstractFileByPath(filePath) as TFile

	if (!file) {
		file = await plugin.app.vault.create(filePath, '')
	}

	const sphereString = spheres.map((sphere) => `#sphere/${sphere}`).join(' ')

	let content = await plugin.app.vault.read(file)
	content = content + '\n- [ ] ' + text

	if (sphereString) {
		content = content + ' ' + sphereString
	}
	if (plugin.settings.appendTagToTask) {
		content = content + ' ' + plugin.settings.appendTagToTask
	}
	content.concat('\n')

	await plugin.app.vault.modify(file, content)
}

export async function addToNextActions(
	plugin: FlowPlugin,
	text: string,
	spheres: string[],
) {
	await addLineToFile(
		plugin,
		text,
		plugin.settings.nextActionsFilePath,
		spheres,
	)
}

export async function addToSomeday(
	plugin: FlowPlugin,
	text: string,
	spheres: string[],
) {
	await addLineToFile(plugin, text, plugin.settings.somedayFilePath, spheres)
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

	if (plugin.settings.appendTagToTask) {
		taskLine.concat(' ' + plugin.settings.appendTagToTask)
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
			'\n' +
			sectionName +
			taskLine +
			' ' +
			plugin.settings.appendTagToTask
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
export async function addToPersonDiscussNext(
	plugin: FlowPlugin,
	projectFile: TFile,
	line: string,
) {
	await addToFileSection(
		plugin,
		projectFile,
		line,
		'## Discuss next',
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

export async function addToPersonReference(
	plugin: FlowPlugin,
	personFile: TFile,
	line: string,
) {
	// TODO: make the section name a setting
	await addToFileSection(plugin, personFile, line, '## Reference')
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

	const templaterPlugin = getPlugin(
		'templater-obsidian',
		plugin,
	) as TemplaterPlugin

	return files.filter((file) => {
		if (
			file.path === plugin.settings.newPersonTemplateFilePath ||
			file.path === plugin.settings.newProjectTemplateFilePath
		) {
			return false
		}

		if (file.path.startsWith(templaterPlugin.settings.template_folder)) {
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

export async function createNewProjectFile(
	plugin: FlowPlugin,
	projectName: string,
): Promise<TFile> {
	const templateFile = plugin.app.vault.getAbstractFileByPath(
		plugin.settings.newProjectTemplateFilePath,
	) as TFile

	const open_in_new_window = false
	const create_new = await getTemplaterCreateNewFunction(plugin)
	return create_new(
		templateFile,
		projectName,
		open_in_new_window,
		plugin.settings.projectsFolderPath,
	)
}

async function getTemplaterCreateNewFunction(
	plugin: FlowPlugin,
): Promise<Function> {
	const templaterPlugin = getPlugin(
		'templater-obsidian',
		plugin,
	) as TemplaterPlugin
	let tp_file =
		templaterPlugin.templater.functions_generator.internal_functions.modules_array.find(
			(m: Module) => m.name == 'file',
		)

	if (tp_file === undefined) {
		console.error(
			"We can't get the templater function. Is it installed correctly?",
		)
	}

	return await tp_file!.static_functions.get('create_new')
}

export async function parseProjectTemplate(options: {
	content: string
	priority: number
	sphere: string
	description: string
}) {
	const { content, priority, sphere, description } = options

	let newContent = content

	const replacements = [
		{
			regex: /{{\s*priority\s*}}/g,
			replaceWith: priority.toString(),
		},
		{
			regex: /{{\s*sphere\s*}}/g,
			replaceWith: sphere,
		},
		{
			regex: /{{\s*description\s*}}/g,
			replaceWith: description,
		},
	]

	function replacer(str: string, regex: RegExp, replaceWith: string) {
		return str.replace(regex, function () {
			return replaceWith
		})
	}

	for (const { regex, replaceWith } of replacements) {
		newContent = replacer(newContent, regex, replaceWith)
	}

	return newContent
}

export function getPlugin(pluginName: string, plugin: FlowPlugin) {
	// @ts-ignore
	return plugin.app.plugins.plugins[pluginName]
}

export const ensureFolderExists = async (
	folderPath: string,
	plugin: FlowPlugin,
) => {
	const folderExists = await plugin.app.vault.adapter.exists(folderPath)
	if (!folderExists) {
		const parentFolder = folderPath.split('/').slice(0, -1).join('/')
		if (parentFolder && parentFolder !== folderPath) {
			await ensureFolderExists(parentFolder, plugin)
		}
		await plugin.app.vault.createFolder(folderPath)
	}
}

export const createFoldersAndFile = async (
	filePath: string,
	contents: string,
	plugin: FlowPlugin,
) => {
	const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))
	if (fileDir) {
		await ensureFolderExists(fileDir, plugin)
	}
	plugin.app.vault.create(filePath, contents)
}
