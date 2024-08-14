import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'

import FlowPlugin from 'main.js'
import { PROCESSING_VIEW_TYPE, ProcessingView } from 'views/processing.js'

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
	inboxFilesFolder: TFolder | null = null
	inboxFolder: TFolder | null = null
	private processingLeaf: WorkspaceLeaf | null = null
	currentStage: Stage.File | Stage.Folder | null = null
	linesToProcess: LineWithFile[] = []
	filesToProcess: TFile[] = []
	private startProcessingLock: boolean = false

	constructor(plugin: FlowPlugin) {
		this.plugin = plugin
		this.app = plugin.app // shortcut for nicer code
	}

	readSettingsPaths() {
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
	}

	async startProcessing() {
		if (this.startProcessingLock) {
			return
		}
		this.startProcessingLock = true
		this.readSettingsPaths()
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

		this.startProcessingLock = false
	}

	async stopProcessing() {
		const existingLeaves =
			this.app.workspace.getLeavesOfType(PROCESSING_VIEW_TYPE)

		for (const leaf of existingLeaves) {
			leaf.detach()
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

	private commonViewProps() {
		return {
			isProcessingComplete:
				this.linesToProcess.length === 0 &&
				this.filesToProcess.length === 0,
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
				...this.commonViewProps(),
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processInboxFolder() {
		await this.updateStatus()

		const view = await this.setupOrGetProcessingView()
		if (view === undefined) {
			console.error('ProcessingView not found')
		}

		let content: string | null = null

		if (this.filesToProcess.length === 0) {
			return
		}

		const file = this.filesToProcess[0]
		content = await this.plugin.app.vault.read(file)

		view?.updateEmbeddedFile(file.path)
		view?.setProps({
			line: `${file.name}`,
			...this.commonViewProps(),
		})
	}

	async updateCounts() {
		this.readSettingsPaths()
		const inboxFiles = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.inboxFilesFolder!.path))

		this.linesToProcess = []

		for (const file of inboxFiles) {
			const content = await this.plugin.app.vault.read(file)
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

	async setupOrGetProcessingView(): Promise<ProcessingView | undefined> {
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
