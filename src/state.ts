import { App, TFile, TFolder, WorkspaceLeaf, Notice } from 'obsidian'
import {
	readFileContent,
	writeFileContent,
	addToNextActions,
	addToProject,
	getFilesWithTagPrefix,
} from './utils'
import InboxView from './components/InboxView.svelte'
import FlowPlugin from './main'
import { ProjectSelectorModal } from './projectSelectorModal'
import { ProjectNameModal } from './projectNameModal'
import { PROCESSING_VIEW_TYPE, ProcessingView } from './views/processing'

export enum Stage {
	Inbox,
	EmailInbox,
}

export class StateManager {
	private app: App
	private plugin: FlowPlugin
	private inboxFile: TFile | null = null
	private emailInboxFolder: TFolder | null = null
	private statusLeaf: WorkspaceLeaf | null = null
	private mainLeaf: WorkspaceLeaf | null = null
	private currentStage: Stage.Inbox | Stage.EmailInbox | null = null
	private linesToProcess: string[] = []
	private emailFilesToProcess: TFile[] = []

	constructor(app: App, plugin: FlowPlugin) {
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

		await this.updateCounts()

		if (await this.isInboxEmpty()) {
			if (await this.isEmailInboxEmpty()) {
				new Notice('Both inboxes are empty')
				await this.completeProcessing()
				if (this.statusLeaf) this.statusLeaf.view.containerEl.empty()
			} else {
				this.currentStage = Stage.EmailInbox
				await this.processEmailInbox()
			}
		} else {
			this.currentStage = Stage.Inbox
			await this.processInbox()
		}
	}

	private async isInboxEmpty(): Promise<boolean> {
		if (!this.inboxFile) return true
		return this.linesToProcess.length === 0
	}

	private async isEmailInboxEmpty(): Promise<boolean> {
		if (!this.emailInboxFolder) return true
		return this.emailFilesToProcess.length === 0
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
					this.emailFilesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async processEmailInbox() {
		await this.updateStatus()
		const view = await this.setupOrGetProcessingView()
		let content = null

		if (this.emailFilesToProcess.length > 0) {
			const emailFile = this.emailFilesToProcess[0]
			content = await readFileContent(emailFile)
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
					this.emailFilesToProcess.length === 0,
			})
		} else {
			console.error('ProcessingView not found')
		}
	}

	private async updateCounts() {
		this.emailFilesToProcess = this.app.vault
			.getMarkdownFiles()
			.filter((file) => file.path.startsWith(this.emailInboxFolder.path))
		const content = await readFileContent(this.inboxFile)
		this.linesToProcess = content
			.split('\n')
			.filter((line) => line.trim() !== '')
	}

	private async updateStatus() {
		this.updateCounts()

		const view = await this.setupOrGetProcessingView()
		view.setProps({
			currentStage: this.currentStage,
			inboxCount: this.linesToProcess.length,
			emailInboxCount: this.emailFilesToProcess.length,
		})
	}

	private async setupOrGetProcessingView(): Promise<
		ProcessingView | undefined
	> {
		const existingLeaves =
			this.app.workspace.getLeavesOfType(PROCESSING_VIEW_TYPE)

		if (existingLeaves.length > 0) {
			this.processingLeaf = existingLeaves[0]
			await this.app.workspace.revealLeaf(this.processingLeaf)
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

	private async setupMainView() {
		if (!this.mainLeaf) {
			const leaf = this.app.workspace.getLeaf(false)
			this.mainLeaf = leaf
		}
	}

	private async removeProcessedItem() {
		if (this.currentStage === Stage.Inbox) {
			const processedLine = this.linesToProcess.shift()
			if (this.linesToProcess.length === 0) {
				this.currentStage = null
			}
			await this.updateInboxFile(processedLine)
			this.startProcessing()
		} else if (this.currentStage === Stage.EmailInbox) {
			const processedFile = this.emailFilesToProcess.shift()
			if (this.emailFilesToProcess.length === 0) {
				this.currentStage = null
			}
			if (processedFile) {
				await this.deleteEmailFile(processedFile)
			}
			this.startProcessing()
		}
	}

	private async updateInboxFile(processedLine: string) {
		if (this.inboxFile) {
			const currentContent = await readFileContent(this.inboxFile)
			const currentLines = currentContent.split('\n')
			const firstNonEmptyLine = currentLines.find(
				(line) => line.trim() !== '',
			)

			if (
				firstNonEmptyLine &&
				firstNonEmptyLine.trim() === processedLine.trim()
			) {
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

	private async deleteEmailFile(file: TFile) {
		await this.app.vault.delete(file)
	}

	private async handleAddToNextActions(text: string) {
		await addToNextActions(this.plugin, text)
		this.removeProcessedItem()
	}

	private async handleAddToProject(text: string) {
		const projectFiles = getFilesWithTagPrefix(this.app, 'project')

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
		new ProjectNameModal(this.app, async (projectName: string) => {
			const templateContent = await this.getTemplateContent()
			const newProjectFile = await this.createNewProjectFile(
				projectName,
				templateContent,
			)
			await this.runThroughTemplater(newProjectFile)
			await addToProject(this.plugin, newProjectFile, text)
			this.removeProcessedItem()
		}).open()
	}

	private async getTemplateContent(): Promise<string> {
		const templatePath = this.plugin.settings.newProjectTemplateFilePath
		const templateFile = this.app.vault.getAbstractFileByPath(
			templatePath,
		) as TFile
		return templateFile ? await this.app.vault.read(templateFile) : ''
	}

	private async runThroughTemplater(file: TFile): Promise<void> {
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
