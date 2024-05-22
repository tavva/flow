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

export class StateManager {
	private app: App
	private plugin: GTDPlugin
	private inboxFile: TFile
	private emailInboxFolder: TFolder
	private statusLeaf: WorkspaceLeaf
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

		await this.setupStatusView()

		if (await this.isInboxEmpty()) {
			if (await this.isEmailInboxEmpty()) {
				new Notice('Both inboxes are empty')
				this.statusLeaf.view.containerEl.empty()
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
		this.updateStatusView()
		const inboxView = new InboxView({
			target: this.statusLeaf.view.containerEl,
			props: {
				line: this.linesToProcess[0],
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onTrash: this.handleTrash.bind(this),
			},
		})
	}

	private async processEmailInbox() {
		this.updateStatusView()
		const emailFile = this.emailFilesToProcess[0]
		const content = await readFileContent(this.app, emailFile)
		const emailInboxView = new InboxView({
			target: this.statusLeaf.view.containerEl,
			props: {
				line: content,
				onAddToNextActions: this.handleAddToNextActions.bind(this),
				onAddToProject: this.handleAddToProject.bind(this),
				onTrash: this.handleTrash.bind(this),
			},
		})
	}

	private async setupStatusView() {
		const leaf = this.app.workspace.getRightLeaf(false)
		leaf.setViewState({ type: 'status-view' })
		this.statusLeaf = leaf
	}

	private updateStatusView() {
		new StatusView({
			target: this.statusLeaf.view.containerEl,
			props: {
				currentStage: this.currentStage,
				inboxCount: this.linesToProcess.length,
				emailInboxCount: this.emailFilesToProcess.length,
				onNextStage: this.startProcessing.bind(this),
			},
		})
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
