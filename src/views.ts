import { WorkspaceLeaf, ItemView, Notice, MarkdownView } from 'obsidian'
import { openFile } from './utils'
import { addToNextActions, addToProject, ProcessStage } from './process'
import { openProjectModalForSelection } from './modals'
import { updateLineCount, updateFileCount, updateStage } from './state'

export const PROCESS_INBOXES_VIEW = 'process-inboxes-view'
export const PROCESS_EMAIL_INBOX_VIEW = 'process-email-inbox-view'

export class ProcessInboxesView extends ItemView {
	constructor(leaf: WorkspaceLeaf, plugin: GTDPlugin) {
		super(leaf)
		this.plugin = plugin
		this.processingStage = ProcessStage.Inbox
		this.svelteComponent = null
	}

	getViewType(): string {
		return PROCESS_INBOXES_VIEW
	}

	getDisplayText(): string {
		return 'Process inboxes view'
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1]
		container.empty()

		const folderPath = this.plugin.settings.incomingEmailFolderPath

		const { default: ProcessInboxesView } = await import(
			'./components/ProcessInboxesView.svelte'
		)
		this.svelteComponent = new ProcessInboxesView({
			target: container,
			props: {
				plugin: this.plugin,
				filePath: this.plugin.settings.inboxFilePath,
				folderPath: folderPath,
			},
		})

		const inboxFile = await openFile(
			this.plugin.settings.inboxFilePath,
			this.plugin,
		)
		this.registerEvent(
			this.plugin.app.vault.on('modify', (file) => {
				if (file.path === inboxFile.path) {
					updateLineCount(this.plugin)
				}
			}),
		)

		function handleFolderChange(file, action) {
			if (file.path.startsWith(folderPath)) {
				updateFileCount(this.plugin)
				console.log(`File ${action} in folder:`, file.path)
			}
		}

		this.plugin.app.vault.on('create', (file) =>
			handleFolderChange(file, 'created'),
		)
		this.plugin.app.vault.on('delete', (file) =>
			handleFolderChange(file, 'deleted'),
		)
	}

	async onClose(): Promise<void> {}
}

export class ProcessEmailInboxView extends ItemView {
	plugin: GTDPlugin
	emailFiles: TFile[]
	currentFileIndex: number = 0
	nextActionInput: HTMLInputElement
	processingStage: string

	constructor(leaf: WorkspaceLeaf, plugin: GTDPlugin) {
		super(leaf)
		this.plugin = plugin
		this.emailFiles = []
		this.processingStage = 'email'
	}

	getViewType(): string {
		return PROCESS_EMAIL_INBOX_VIEW
	}

	getDisplayText(): string {
		return 'Process Email Inbox'
	}

	async onOpen(): Promise<void> {
		this.render()
	}

	private async render(): Promise<void> {
		await this.displayProcessingOptions()

		if (this.processingStage === 'email') {
			await this.loadEmailFiles()
			await this.processCurrentEmail()
			await this.displayEmailFiles()
		}
	}

	private async displayProcessingOptions(): Promise<void> {
		const container = this.containerEl.children[1]
		const optionsContainer = container.createDiv('email-processing-options')

		this.nextActionInput = optionsContainer.createEl('input', {
			type: 'text',
			placeholder: 'Enter next action text...',
			cls: 'next-action-input',
		})

		const buttons = [
			{
				text: 'Add to Project',
				callback: () => this.addToProject(this.nextActionInput.value),
			},
			{
				text: 'Add to Next Actions',
				callback: () =>
					this.addToNextActions(this.nextActionInput.value),
			},
			{ text: 'Delete', callback: this.deleteFile.bind(this) },
		]

		buttons.forEach(({ text, callback }) => {
			optionsContainer
				.createEl('button', { text })
				.addEventListener('click', callback)
		})
	}

	private async refreshEmailFilesList(): Promise<void> {
		await this.loadEmailFiles()
		this.currentFileIndex = 0
		await this.processCurrentEmail()
		await this.displayEmailFiles()
	}

	private closeTabsForFile(file: TFile): void {
		const leaves = this.plugin.app.workspace.getLeavesOfType('markdown')
		leaves.forEach(async (leaf) => {
			if ((await leaf.view.getState().file) === file.path) {
				leaf.detach()
			}
		})
	}

	private async loadEmailFiles(): Promise<void> {
		const incomingEmailFolderPath =
			this.plugin.settings.incomingEmailFolderPath
		this.emailFiles = this.plugin.app.vault.getFiles().filter((file) => {
			return (
				file.path.startsWith(incomingEmailFolderPath) &&
				file.extension === 'md'
			)
		})
	}

	private async displayEmailFiles(): Promise<void> {
		const container = this.containerEl.children[1]

		let fileListEl = container.querySelector('ul')
		if (fileListEl) {
			fileListEl.remove()
		}
		fileListEl = container.createEl('ul')

		this.emailFiles.forEach((file, index) => {
			const fileEl = fileListEl.createEl('li', {
				text: file.basename,
				cls: index === this.currentFileIndex ? 'is-active' : '',
			})
			fileEl.addEventListener('click', async () => {
				this.currentFileIndex = index
				await this.processCurrentEmail()
				await this.displayEmailFiles()
			})
		})
	}

	private async processCurrentEmail(): Promise<void> {
		if (this.emailFiles.length === 0) {
			return
		}

		const currentFile = this.emailFiles[this.currentFileIndex]

		let emailLeaf = this.plugin.app.workspace.getLeavesOfType('markdown')[0]
		if (!emailLeaf) {
			emailLeaf = this.plugin.app.workspace.getLeaf(true)
			emailLeaf.setViewState({ type: 'markdown' })
		}

		await emailLeaf.openFile(currentFile)
	}

	private async addToProject(line: string): Promise<void> {
		const actionText = line.trim()
		if (line.trim() == '') {
			new Notice('Please enter a valid next action', 5000)
			return
		}

		const selectedProject = await openProjectModalForSelection(
			this.plugin.app,
		)

		if (selectedProject) {
			await addToProject(app, selectedProject.path, line)
		} else {
			console.error('No project was selected.')
		}

		this.nextActionInput.value = ''
		await this.deleteFile()
		await this.refreshEmailFilesList()
	}

	private async addToNextActions(line: string): Promise<void> {
		const actionText = line.trim()
		if (line.trim() == '') {
			new Notice('Please enter a valid next action', 5000)
			return
		}
		await addToNextActions(this.plugin, line.trim())
		this.nextActionInput.value = ''
		await this.deleteFile()
		await this.refreshEmailFilesList()
	}

	private async deleteFile(): Promise<void> {
		const currentFile = this.emailFiles[this.currentFileIndex]
		await this.plugin.app.vault.trash(currentFile, true)
		this.closeTabsForFile(currentFile)
		await this.refreshEmailFilesList()
	}

	async onClose(): Promise<void> {}
}
