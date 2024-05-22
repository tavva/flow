import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'
import {
	readFileContent,
	writeFileContent,
	addToNextActions,
	addToProject,
} from './utils'
import InboxView from './components/InboxView.svelte'
import StatusView from './components/StatusView.svelte'
import GTDPlugin from './main'
import { ProjectSelectorModal } from './projectSelectorModal'
import { STATUS_VIEW_TYPE } from './views/status'
import { PROCESSING_VIEW_TYPE, ProcessingView } from './views/processing'

export class StateManager {
	private app: App
	private plugin: GTDPlugin
	private inboxFile: TFile | null = null
	private emailInboxFolder: TFolder | null = null
	private statusLeaf: WorkspaceLeaf | null = null
	private mainLeaf: WorkspaceLeaf | null = null
	private currentStage: 'inbox' | 'emailInbox' | null = null
	private linesToProcess: string[] = []
	private emailFilesToProcess: TFile[] = []

	constructor(app: App, plugin: GTDPlugin) {
		this.app = app
		this.plugin = plugin
	}

	async startProcessing() {
		this.inboxFile = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFilePath,
		) as TFile
		this.emailInboxFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.emailInboxFolderPath,
		) as TFolder

		if (!this.inboxFile) {
			new Notice('Inbox file not found. Please check your settings.')
			return
		}

		if (!this.emailInboxFolder) {
			new Notice(
				'Email Inbox folder not found. Please check your settings.',
			)
			return
		}

		await this.setupStatusView()

		if (await this.isInboxEmpty()) {
			if (await this.isEmailInboxEmpty()) {
				new Notice('Both inboxes are empty')
				if (this.statusLeaf) this.statusLeaf.view.containerEl.empty()
			} else {
				this.currentStage = 'emailInbox'
				await this.processEmailInbox()
			}
		} else {
			this.currentStage = 'inbox'
			await this.processInbox()
		}
	}

	private async isInboxEmpty(): Promise<boolean> {
		if (!this.inboxFile) return true
		const content = await readFileContent(this.inboxFile)
		this.linesToProcess = content
			.split('\n')
			.filter((line) => line.trim() !== '')
		return this.linesToProcess.length === 0
	}

	private async isEmailInboxEmpty(): Promise<boolean> {
		if (!this.emailInboxFolder) return true
		this.emailFilesToProcess = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.emailInboxFolder.path))
		return this.emailFilesToProcess.length === 0
	}

	private async processInbox() {
		await this.updateStatusView()
		await this.setupProcessingView()
		const view = this.app.workspace.getActiveViewOfType(ProcessingView)
		if (view) {
			view.setProps({
				line: this.linesToProcess[0],
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onTrash: this.handleTrash.bind(this),
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processEmailInbox() {
		await this.updateStatusView()
		await this.setupProcessingView()
		const emailFile = this.emailFilesToProcess[0]
		const content = await readFileContent(this.app, emailFile)
		const view = this.app.workspace.getActiveViewOfType(ProcessingView)
		if (view) {
			view.setProps({
				line: content,
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onTrash: this.handleTrash.bind(this),
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async setupStatusView() {
		const existingLeaf =
			this.app.workspace.getLeavesOfType(STATUS_VIEW_TYPE)
		if (existingLeaf.length) {
			this.statusLeaf = existingLeaf[0]
		} else {
			const leaf = this.app.workspace.getRightLeaf(false)
			await leaf.setViewState({
				type: STATUS_VIEW_TYPE,
				active: true,
			})
			this.statusLeaf = leaf
		}
		this.updateStatusView()
	}

	private async updateStatusView() {
		if (this.statusLeaf) {
			const view = this.statusLeaf.view as StatusView
			if (view.getViewType() === STATUS_VIEW_TYPE) {
				view.setProps({
					currentStage: this.currentStage,
					inboxCount: this.linesToProcess.length,
					emailInboxCount: this.emailFilesToProcess.length,
					onNextStage: this.startProcessing.bind(this),
				})
			} else {
				console.error('StatusView not found')
			}
		} else {
			console.error('Status leaf is not initialized')
		}
	}

	private async setupProcessingView() {
		const existingLeaf =
			this.app.workspace.getLeavesOfType(PROCESSING_VIEW_TYPE)
		if (existingLeaf.length) {
			this.processingLeaf = existingLeaf[0]
			console.log('Reusing existing ProcessingView')
		} else {
			const leaf = this.app.workspace.getLeaf(false)
			await leaf.setViewState({
				type: PROCESSING_VIEW_TYPE,
				active: true,
			})
			this.processingLeaf = leaf
			console.log('Created new ProcessingView')
		}
	}

	private async setupMainView() {
		if (!this.mainLeaf) {
			const leaf = this.app.workspace.getLeaf(false)
			this.mainLeaf = leaf
		}
	}

	private removeProcessedItem() {
		if (this.currentStage === 'inbox') {
			this.linesToProcess.shift()
			if (this.linesToProcess.length === 0) {
				this.currentStage = null
				this.startProcessing()
			} else {
				this.processInbox()
			}
		} else if (this.currentStage === 'emailInbox') {
			this.emailFilesToProcess.shift()
			if (this.emailFilesToProcess.length === 0) {
				this.currentStage = null
				this.startProcessing()
			} else {
				this.processEmailInbox()
			}
		}
	}

	private async handleAddToNextActions(text: string) {
		await addToNextActions(this.app, text)
		this.removeProcessedItem()
	}

	private async handleAddToProject(text: string) {
		const projectFiles = this.app.vault
			.getMarkdownFiles()
			.filter((file) => {
				const cache = this.app.metadataCache.getFileCache(file)
				return cache?.frontmatter?.tags?.includes('#project')
			})

		new ProjectSelectorModal(
			this.app,
			projectFiles,
			async (file: TFile) => {
				await addToProject(this.app, file, text)
				this.removeProcessedItem()
			},
		).open()
	}

	private handleTrash() {
		this.removeProcessedItem()
	}
}

export default StateManager
