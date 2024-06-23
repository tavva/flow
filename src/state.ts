import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'

import { readFileContent } from 'utils'
import FlowPlugin from 'main'
import { Handlers } from 'handlers'
import { PROCESSING_VIEW_TYPE, ProcessingView } from 'views/processing'

export enum Stage {
	File = 'file',
	Folder = 'folder',
}

export interface LineWithFile {
	file: TFile
	line: string
}

export class StateManager {
	private app: App
	private plugin: FlowPlugin
	private handlers: Handlers
	inboxFilesFolder: TFolder | null = null
	inboxFolder: TFolder | null = null
	private processingLeaf: WorkspaceLeaf | null = null
	currentStage: Stage.File | Stage.Folder | null = null
	linesToProcess: LineWithFile[] = []
	filesToProcess: TFile[] = []

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.app = plugin.app // shortcut for nicer code
		this.handlers = new Handlers(plugin, this)
	}

	async startProcessing() {
		this.inboxFilesFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFilesFolderPath,
		) as TFolder
		this.inboxFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFolderPath,
		) as TFolder

		if (!this.inboxFilesFolder) {
			new Notice(`Inbox file folder not found. Please check your
					   settings.`)
			return
		}

		if (!this.inboxFolder) {
			new Notice('Inbox folder not found. Please check your settings.')
			return
		}

		await this.updateCounts()

		if (await this.areInboxFilesEmpty()) {
			if (await this.isFolderInboxEmpty()) {
				new Notice('Both inboxes are empty')
				await this.completeProcessing()
			} else {
				this.currentStage = Stage.Folder
				await this.processInboxFolder()
			}
		} else {
			this.currentStage = Stage.File
			await this.processInboxFiles()
		}
	}

	private async areInboxFilesEmpty(): Promise<boolean> {
		if (!this.inboxFilesFolder) return true
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

	private async processInboxFiles() {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()

		if (view) {
			view.setProps({
				line: this.linesToProcess[0].line,
				noteContent: '',
				currentStage: this.currentStage,
				onAddToNextActions: this.handlers.handleAddToNextActions,
				onAddToProjectNextActions:
					this.handlers.handleAddToProjectNextActions,
				onAddToProjectReference:
					this.handlers.handleAddToProjectReference,
				onAddToPersonDiscussNext:
					this.handlers.handleAddToPersonDiscussNext,
				onAddToPersonReference:
					this.handlers.handleAddToPersonReference,
				onAddToNewProject: this.handlers.handleNewProject,
				onAddToSomeday: this.handlers.handleAddToSomeday,
				onTrash: this.handlers.handleTrash,
				isProcessingComplete:
					this.linesToProcess.length === 0 &&
					this.filesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processInboxFolder() {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()
		let content: string | null = null

		if (this.filesToProcess.length > 0) {
			const file = this.filesToProcess[0]
			content = await readFileContent(this.plugin, file)
			view!.updateEmbeddedFile(file.path)
		}

		// TODO: abstract this out as we're repeating ourselves
		if (view) {
			view.setProps({
				line: content,
				onAddToNextActions: this.handlers.handleAddToNextActions,
				onAddToProjectNextActions:
					this.handlers.handleAddToProjectNextActions,
				onAddToProjectReference:
					this.handlers.handleAddToProjectReference,
				onAddToNewProject: this.handlers.handleNewProject,
				onAddToSomeday: this.handlers.handleAddToSomeday,
				onTrash: this.handlers.handleTrash,
				isProcessingComplete:
					this.linesToProcess.length === 0 &&
					this.filesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	async updateCounts() {
		const inboxFiles = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.inboxFilesFolder!.path))

		this.linesToProcess = []

		for (const file of inboxFiles) {
			const content = await readFileContent(this.plugin, file)
			const lines = content
				.split('\n')
				.filter((line) => line.trim() !== '')
				.map((line) => ({ file, line }))
			this.linesToProcess = this.linesToProcess.concat(lines)
		}
		this.filesToProcess = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.inboxFolder!.path))

		const view = await this.getProcessingViewIfActive()
		if (view) {
			view.setProps({
				lineCount: this.linesToProcess.length,
				fileCount: this.filesToProcess.length,
			})
		}
	}

	private async updateStatus() {
		await this.updateCounts()

		const view = await this.setupOrGetProcessingView()
		if (!view) {
			console.error('ProcessingView not found')
			return
		}

		view.setProps({
			currentStage: this.currentStage,
			lineCount: this.linesToProcess.length,
			fileCount: this.filesToProcess.length,
		})
	}

	private async getProcessingViewIfActive(): Promise<
		ProcessingView | undefined
	> {
		const view = this.app.workspace.getActiveViewOfType(ProcessingView)

		if (view) {
			return view as ProcessingView
		}
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
}
