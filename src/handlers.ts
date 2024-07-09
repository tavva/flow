import { App, TFile } from 'obsidian'
import type { TemplaterPlugin, Module } from 'typings/templater'

import {
	addToNextActions,
	addToSomeday,
	addToProjectNextActions,
	addToProjectReference,
	addToPersonDiscussNext,
	addToPersonReference,
	getFilesWithTagPrefix,
	readFileContent,
	getPlugin,
} from 'utils'

import FlowPlugin from 'main'

import { FileSelectorModal } from 'modals/fileSelectorModal'
import { NewProjectModal } from 'modals/newProjectModal'
import { SphereSelectorModal } from 'modals/sphereSelectorModal'

import { StateManager, Stage, type LineWithFile } from 'state'

export class Handlers {
	private app: App
	private plugin: FlowPlugin
	private state: StateManager
	private templaterPlugin: TemplaterPlugin

	constructor(plugin: FlowPlugin, stateManager: StateManager) {
		this.plugin = plugin
		this.app = plugin.app
		this.state = stateManager
		this.templaterPlugin = getPlugin(
			'templater-obsidian',
			plugin,
		) as TemplaterPlugin
	}

	handleAddToNextActions = async (text: string) => {
		new SphereSelectorModal(
			this.app,
			this.plugin.settings.spheres,
			async (selectedSpheres: string[]) => {
				await addToNextActions(this.plugin, text, selectedSpheres)
				await this.removeProcessedItem()
				this.plugin.metrics.count('action-created')
			},
		).open()
	}

	handleAddToProjectNextActions = async (text: string) => {
		const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

		new FileSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToProjectNextActions(this.plugin, file, text)
				await this.removeProcessedItem()
				this.plugin.metrics.count('project-action-created')
			},
			'Select a project',
			'Search projects...',
		).open()
	}

	handleAddToPersonDiscussNext = async (text: string) => {
		const personFiles = getFilesWithTagPrefix(this.plugin, 'person')

		new FileSelectorModal(
			this.app,
			personFiles,
			async (file: TFile) => {
				await addToPersonDiscussNext(this.plugin, file, text)
				await this.removeProcessedItem()
				this.plugin.metrics.count('person-action-created')
			},
			'Select a person',
			'Search for a person',
		).open()
	}

	handleAddToProjectReference = async (text: string) => {
		const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

		new FileSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToProjectReference(this.plugin, file, text)
				await this.removeProcessedItem()
				this.plugin.metrics.count('project-reference-created')
			},
			'Select a project',
			'Search projects...',
		).open()
	}

	handleAddToPersonReference = async (text: string) => {
		const projectFiles = getFilesWithTagPrefix(this.plugin, 'person')

		new FileSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToPersonReference(this.plugin, file, text)
				await this.removeProcessedItem()
				this.plugin.metrics.count('person-reference-created')
			},
			'Select a person',
			'Search for a person',
		)
	}

	handleAddToSomeday = async (text: string) => {
		new SphereSelectorModal(
			this.app,
			this.plugin.settings.spheres,
			async (selectedSpheres: string[]) => {
				await addToSomeday(this.plugin, text, selectedSpheres)
				await this.removeProcessedItem()
				this.plugin.metrics.count('add-to-someday')
			},
		).open()
	}

	private replacer(str: string, regex: RegExp, replaceWith: string) {
		return str.replace(regex, function () {
			return replaceWith
		})
	}

	handleNewProject = async (text: string) => {
		new NewProjectModal(
			this.plugin,
			text,
			async (
				projectName: string,
				description: string,
				spheres: Set<string>,
				priority: number,
			) => {
				const projectFile = await this.createNewProjectFile(projectName)
				let content = await this.app.vault.read(projectFile)

				const sphereText = Array.from(spheres)
					.map((s) => `project/${s}`)
					.join(' ')

				content = await this.parseTemplate({
					content: content,
					priority: priority,
					sphere: sphereText,
					description: description,
				})

				await this.app.vault.modify(projectFile, content)

				await addToProjectNextActions(this.plugin, projectFile, text)

				await this.removeProcessedItem()
				this.plugin.metrics.count('new-project-created')
			},
		).open()
	}

	handleTrash = async () => {
		await this.removeProcessedItem()
		this.plugin.metrics.count('item-trashed')
	}

	private async removeProcessedItem() {
		if (this.state.currentStage === Stage.File) {
			const processedLine = this.state.linesToProcess.shift()
			if (this.state.linesToProcess.length === 0) {
				this.state.currentStage = null
			}
			if (processedLine) {
				await this.updateInboxFile(processedLine)
			}
			this.plugin.metrics.count('line-processed')
			this.state.startProcessing()
		} else if (this.state.currentStage === Stage.Folder) {
			const processedFile = this.state.filesToProcess.shift()
			if (this.state.filesToProcess.length === 0) {
				this.state.currentStage = null
			}
			if (processedFile) {
				await this.deleteFolderFile(processedFile)
			}
			this.plugin.metrics.count('file-processed')
			this.state.startProcessing()
		}
	}

	private async parseTemplate(options: {
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

		for (const { regex, replaceWith } of replacements) {
			newContent = this.replacer(newContent, regex, replaceWith)
		}

		return newContent
	}

	private async updateInboxFile(processedLine: LineWithFile) {
		const { file, line } = processedLine

		if (this.state.inboxFilesFolder) {
			await this.removeEmptyLinesFromFile(file)

			const currentContent = await readFileContent(this.plugin, file)
			const currentLines = currentContent.split('\n')
			const firstLine = currentLines[0]
			if (firstLine && firstLine.trim() === line.trim()) {
				const updatedContent = currentLines.slice(1).join('\n')
				await this.app.vault.modify(file, updatedContent)
			} else {
				console.log('processedLine:', processedLine)
				console.log('currentLines[0]:', currentLines[0])
				console.error(
					'Mismatch in the processed line and the current first line',
				)
			}
		}
	}

	private async deleteFolderFile(file: TFile) {
		await this.app.vault.delete(file)
	}

	async createNewProjectFile(projectName: string): Promise<TFile> {
		const templateFile = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.newProjectTemplateFilePath,
		) as TFile

		const open_in_new_window = false
		const create_new = await this.getTemplaterCreateNewFunction()
		return create_new(
			templateFile,
			projectName,
			open_in_new_window,
			this.plugin.settings.projectsFolderPath,
		)
	}

	private async removeEmptyLinesFromFile(file: TFile): Promise<void> {
		const content = await readFileContent(this.plugin, file)
		const nonEmptyLines = content
			.split('\n')
			.filter((line) => line.trim() !== '')
			.join('\n')
		await this.app.vault.modify(file, nonEmptyLines)
	}

	private async getTemplaterCreateNewFunction(): Promise<Function> {
		let tp_file =
			this.templaterPlugin.templater.functions_generator.internal_functions.modules_array.find(
				(m: Module) => m.name == 'file',
			)

		if (tp_file === undefined) {
			console.error(
				"We can't get the templater function. Is it installed correctly?",
			)
		}

		return await tp_file!.static_functions.get('create_new')
	}
}
