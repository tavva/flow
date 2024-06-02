import { App, TFile, Notice } from 'obsidian'
import {
	addToNextActions,
	addToProject,
	getFilesWithTagPrefix,
	readFileContent,
} from './utils'

import { ProjectSelectorModal } from './modals/projectSelectorModal'
import { NewProjectModal } from './modals/newProjectModal'
import { ContextSelectorModal } from './modals/contextSelectorModal'

import FlowPlugin from './main'
import { StateManager, Stage, LineWithFile } from './state'

export class Handlers {
	private app: App
	private plugin: FlowPlugin
	private state: StateManager
	private tp: any // TODO: make this a proper type, and maybe a better name

	constructor(plugin: FlowPlugin, stateManager: StateManager) {
		this.plugin = plugin
		this.app = plugin.app
		this.state = stateManager
		// @ts-ignore
		this.tp = plugin.app.plugins.plugins['templater-obsidian']
	}

	handleAddToNextActions = async (text: string) => {
		new ContextSelectorModal(
			this.app,
			this.plugin.settings.contexts,
			async (selectedContexts: string[]) => {
				await addToNextActions(this.plugin, text, selectedContexts)
				await this.removeProcessedItem()
			},
		).open()
	}

	handleAddToProject = async (text: string) => {
		const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

		new ProjectSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToProject(this.plugin, file, text)
				await this.removeProcessedItem()
			},
		).open()
	}

	private replacer(str: string, regex: RegExp, replaceWith: string) {
		return str.replace(regex, function () {
			return replaceWith
		})
	}

	handleAddToNewProject = async (text: string) => {
		new NewProjectModal(
			this.plugin,
			async (
				projectName: string,
				contexts: Set<string>,
				priority: number,
			) => {
				if (contexts.size !== 1) {
					new Notice(
						'Only one context can be selected for new project',
					)
					return
				}

				const context = contexts.values().next().value

				const projectFile = await this.createNewProjectFile(projectName)
				let content = await this.app.vault.read(projectFile)

				content = await this.parseTemplate(
					content,
					priority,
					`project/${context}`,
				)

				await this.app.vault.modify(projectFile, content)

				await addToProject(this.plugin, projectFile, text)

				await this.removeProcessedItem()
			},
		).open()
	}

	handleTrash = async () => {
		await this.removeProcessedItem()
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
			this.state.startProcessing()
		} else if (this.state.currentStage === Stage.Folder) {
			const processedFile = this.state.filesToProcess.shift()
			if (this.state.filesToProcess.length === 0) {
				this.state.currentStage = null
			}
			if (processedFile) {
				await this.deleteFolderFile(processedFile)
			}
			this.state.startProcessing()
		}
	}

	private async parseTemplate(
		content: string,
		priority: number,
		context: string,
	) {
		const replacements = [
			{
				regex: /{{\s*priority\s*}}/g,
				replaceWith: priority.toString(),
			},
			{
				regex: /{{\s*context\s*}}/g,
				replaceWith: context,
			},
		]

		for (const { regex, replaceWith } of replacements) {
			content = this.replacer(content, regex, replaceWith)
		}

		return content
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

	private async getTemplaterCreateNewFunction() {
		let tp_file =
			this.tp.templater.functions_generator.internal_functions.modules_array.find(
				(m: any) => m.name == 'file', // FIXME: any
			)

		return await tp_file.static_functions.get('create_new')
	}
}
