import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'
import {
	addToNextActions,
	addToProject,
	readFileContent,
	writeFileContent,
} from './utils'
import InboxView from './components/InboxView.svelte'
import StatusView from './components/StatusView.svelte'

export class StateManager {
	private app: App
	private plugin: Plugin
	private inboxFile: TFile
	private emailInboxFolder: TFolder
	private statusLeaf: WorkspaceLeaf
	private currentStage: 'inbox' | 'emailInbox' | null = null
	private linesToProcess: string[] = []
	private emailFilesToProcess: TFile[] = []

	constructor(app: App, plugin: Plugin) {
		this.app = app
		this.plugin = plugin
		this.inboxFile = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.inboxFilePath,
		) as TFile
		this.emailInboxFolder = this.app.vault.getAbstractFileByPath(
			this.plugin.settings.emailInboxFolderPath,
		) as TFolder
	}

	async startProcessing() {
		await this.setupStatusView()

		if (!this.isInboxEmpty()) {
			this.currentStage = 'inbox'
			await this.processInbox()
		} else if (!this.isEmailInboxEmpty()) {
			this.currentStage = 'emailInbox'
			await this.processEmailInbox()
		} else {
			new Notice('Both inboxes are empty')
		}
	}

	isInboxEmpty(): boolean {
		// TODO: Fix this
		return this.inboxFile.stat.size === 0
	}

	isEmailInboxEmpty(): boolean {
		// TODO: Fix this
		return this.emailInboxFolder.children.length === 0
	}

	private async setupStatusView() {
		this.statusLeaf = this.app.workspace.getRightLeaf(false)
		new StatusView({
			target: this.statusLeaf.view.containerEl,
			props: {
				inboxCount: await this.getInboxLineCount(),
				emailInboxCount: this.getEmailFileCount(),
				currentStage: this.currentStage,
			},
		})
	}

	private async getInboxLineCount(): Promise<number> {
		const content = await readFileContent(this.inboxFile)
		this.linesToProcess = content
			.split('\n')
			.filter((line) => line.trim() !== '')
		return this.linesToProcess.length
	}

	private getEmailFileCount(): number {
		this.emailFilesToProcess = this.emailInboxFolder.children as TFile[]
		return this.emailFilesToProcess.length
	}

	private async processInbox() {
		if (this.linesToProcess.length === 0) {
			if (!this.isEmailInboxEmpty()) {
				this.currentStage = 'emailInbox'
				await this.processEmailInbox()
			}
			return
		}

		const firstLine = this.linesToProcess[0]
		this.showInboxView(firstLine)
	}

	private async processEmailInbox() {
		if (this.emailFilesToProcess.length === 0) return

		const firstFile = this.emailFilesToProcess[0]
		const content = await readFileContent(firstFile)
		this.showEmailView(firstFile.name, content)
	}

	private showInboxView(line: string) {
		const mainLeaf = this.app.workspace.getActiveLeaf()
		new InboxView({
			target: mainLeaf.view.containerEl,
			props: {
				line,
				onAddToNextActions: (text: string) =>
					this.handleAddToNextActions(text),
				onAddToProject: (text: string) => this.handleAddToProject(text),
				onTrash: () => this.handleTrash(),
			},
		})
	}

	private showEmailView(filename: string, content: string) {
		const mainLeaf = this.app.workspace.getActiveLeaf()
		new InboxView({
			target: mainLeaf.view.containerEl,
			props: {
				line: '',
				filename,
				content,
				onAddToNextActions: (text: string) =>
					this.handleAddToNextActions(text),
				onAddToProject: (text: string) => this.handleAddToProject(text),
				onTrash: () => this.handleTrash(),
			},
		})
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

	private removeProcessedItem() {
		if (this.currentStage === 'inbox') {
			this.linesToProcess.shift()
			this.processInbox()
		} else if (this.currentStage === 'emailInbox') {
			this.emailFilesToProcess.shift()
			this.processEmailInbox()
		}
	}
}
