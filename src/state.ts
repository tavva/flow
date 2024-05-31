import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'
import {
	readFileContent,
	addToNextActions,
	addToProject,
	getFilesWithTagPrefix,
} from './utils'
import FlowPlugin from './main'
import { ProjectSelectorModal } from './modals/projectSelectorModal'
import { NewProjectModal } from './modals/newProjectModal'
import { ContextSelectorModal } from './modals/contextSelectorModal'
import { PROCESSING_VIEW_TYPE, ProcessingView } from './views/processing'

export enum Stage {
	File = 'file',
	Folder = 'folder',
}

export class StateManager {
	private app: App
	private plugin: FlowPlugin
	private inboxFile: TFile | null = null
	private inboxFolder: TFolder | null = null
	private processingLeaf: WorkspaceLeaf | null = null
	private currentStage: Stage.File | Stage.Folder | null = null
	private linesToProcess: string[] = []
	private filesToProcess: TFile[] = []

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.app = plugin.app // shortcut for nicer code
	}

	async startProcessing() {
		this.inboxFile = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFilePath,
		) as TFile
		this.inboxFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFolderPath,
		) as TFolder

		if (!this.inboxFile) {
			new Notice('Inbox file not found. Please check your settings.')
			return
		}

		if (!this.inboxFolder) {
			new Notice('Inbox folder not found. Please check your settings.')
			return
		}

		await this.updateCounts()

		if (await this.isInboxFileEmpty()) {
			if (await this.isFolderInboxEmpty()) {
				new Notice('Both inboxes are empty')
				await this.completeProcessing()
			} else {
				this.currentStage = Stage.Folder
				await this.processFolder()
			}
		} else {
			this.currentStage = Stage.File
			await this.processInbox()
		}
	}

	private async isInboxFileEmpty(): Promise<boolean> {
		if (!this.inboxFile) return true
		return this.linesToProcess.length === 0
	}

	private async isFolderInboxEmpty(): Promise<boolean> {
		if (!this.inboxFolder) return true
		return this.filesToProcess.length === 0
	}

	private async completeProcessing(): Promise<void> {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()

		if (view) {
			view.setProps({
				isProcessingComplete: true,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processInbox() {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()

		if (view) {
			view.setProps({
				line: this.linesToProcess[0],
				currentStage: this.currentStage,
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onAddToNewProject: this.handleAddToNewProject.bind(this),
				onTrash: this.handleTrash.bind(this),
				isProcessingComplete:
					this.linesToProcess.length === 0 &&
					this.filesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processFolder() {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()
		let content: string | null = null

		if (this.filesToProcess.length > 0) {
			const file = this.filesToProcess[0]
			content = await readFileContent(this.plugin, file)
		}

		if (view) {
			view.setProps({
				line: content,
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onAddToNewProject: this.handleAddToNewProject.bind(this),
				onTrash: this.handleTrash.bind(this),
				isProcessingComplete:
					this.linesToProcess.length === 0 &&
					this.filesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async updateCounts() {
		this.filesToProcess = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.inboxFolder!.path))
		const content = await readFileContent(this.plugin, this.inboxFile!)
		this.linesToProcess = content
			.split('\n')
			.filter((line) => line.trim() !== '')
	}

	private async updateStatus() {
		this.updateCounts()

		const view = await this.setupOrGetProcessingView()
		view!.setProps({
			currentStage: this.currentStage,
			lineCount: this.linesToProcess.length,
			fileCount: this.filesToProcess.length,
		})
	}

	private async setupOrGetProcessingView(): Promise<
		ProcessingView | undefined
	> {
		const existingLeaves =
			this.app.workspace.getLeavesOfType(PROCESSING_VIEW_TYPE)

		if (existingLeaves.length > 0) {
			this.processingLeaf = existingLeaves[0]
			this.app.workspace.revealLeaf(this.processingLeaf)
		} else {
			const leaf = this.app.workspace.getLeaf(false)
			await leaf.setViewState({
				type: PROCESSING_VIEW_TYPE,
				active: true,
			})
			this.processingLeaf = leaf
		}

		const view = this.processingLeaf.view as ProcessingView
		if (view.getViewType() === PROCESSING_VIEW_TYPE) {
			return view
		} else {
			console.error('ProcessingView not found')
			return undefined
		}
	}

	private async removeProcessedItem() {
		if (this.currentStage === Stage.File) {
			const processedLine = this.linesToProcess.shift()
			if (this.linesToProcess.length === 0) {
				this.currentStage = null
			}
			if (processedLine) {
				await this.updateInboxFile(processedLine)
			}
			this.startProcessing()
		} else if (this.currentStage === Stage.Folder) {
			const processedFile = this.filesToProcess.shift()
			if (this.filesToProcess.length === 0) {
				this.currentStage = null
			}
			if (processedFile) {
				await this.deleteFolderFile(processedFile)
			}
			this.startProcessing()
		}
	}

	private async removeEmptyLinesFromFile(
		plugin: FlowPlugin,
		file: TFile,
	): Promise<void> {
		const content = await readFileContent(plugin, file)
		const nonEmptyLines = content
			.split('\n')
			.filter((line) => line.trim() !== '')
			.join('\n')
		await plugin.app.vault.modify(file, nonEmptyLines)
	}

	private async updateInboxFile(processedLine: string) {
		if (this.inboxFile) {
			await this.removeEmptyLinesFromFile(this.plugin, this.inboxFile)

			const currentContent = await readFileContent(
				this.plugin,
				this.inboxFile,
			)
			const currentLines = currentContent.split('\n')
			const firstLine = currentLines[0]
			if (firstLine && firstLine.trim() === processedLine.trim()) {
				const updatedContent = currentLines.slice(1).join('\n')
				await this.app.vault.modify(this.inboxFile, updatedContent)
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

	private async handleAddToNextActions(text: string) {
		new ContextSelectorModal(
			this.app,
			this.plugin.settings.contexts,
			async (selectedContexts: string[]) => {
				await addToNextActions(this.plugin, text, selectedContexts)
				this.removeProcessedItem()
			},
		).open()
	}

	private async handleAddToProject(text: string) {
		const projectFiles = getFilesWithTagPrefix(this.plugin, 'project')

		new ProjectSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToProject(this.plugin, file, text)
				this.removeProcessedItem()
			},
		).open()
	}

	private async handleAddToNewProject(text: string) {
		new NewProjectModal(
			this.app,
			this.plugin.settings.contexts,
			async (projectName: string, contexts: Set<string>) => {
				const templateContent = await this.getTemplateContent()
				const newProjectFile = await this.createNewProjectFile(
					projectName,
					templateContent,
				)
				await this.runThroughTemplater(newProjectFile)
				await addToProject(this.plugin, newProjectFile, text)
				this.removeProcessedItem()
			},
		).open()
	}

	private async getTemplateContent(): Promise<string> {
		const templatePath = this.plugin.settings.newProjectTemplateFilePath
		const templateFile = this.app.vault.getAbstractFileByPath(
			templatePath,
		) as TFile
		return templateFile ? await this.app.vault.read(templateFile) : ''
	}

	private async runThroughTemplater(file: TFile): Promise<void> {
		// @ts-ignore
		const templaterPlugin = this.app.plugins.plugins['templater-obsidian']
		if (templaterPlugin) {
			// We replicate RunMode from the Templater plugin, but with
			// the only mode we need here
			enum RunMode {
				CreateNewFromTemplate,
			}

			const templater = templaterPlugin.templater
			const config = templater.create_running_config(
				undefined,
				file,
				RunMode.CreateNewFromTemplate,
			)

			const fileContent = await this.app.vault.read(file)

			const outputContent = await templater.parse_template(
				config,
				fileContent,
			)
			await this.app.vault.modify(file, outputContent)
		}
	}

	private async createNewProjectFile(
		projectName: string,
		content: string,
	): Promise<TFile> {
		const projectsFolder = this.plugin.settings.projectsFolderPath
		const newPath = `${projectsFolder}/${projectName}.md`
		return await this.app.vault.create(newPath, content)
	}

	private handleTrash() {
		this.removeProcessedItem()
	}
}
