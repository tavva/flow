import { App, Modal, TFile } from 'obsidian'

export class ProjectSelectorModal extends Modal {
	private projectFiles: TFile[]
	private onSelect: (file: TFile) => void
	private searchQuery: string = ''
	private projectContainer: HTMLElement | null = null

	constructor(
		app: App,
		projectFiles: TFile[],
		onSelect: (file: TFile) => void,
	) {
		super(app)
		this.projectFiles = projectFiles
		this.onSelect = onSelect
		this.updateProjectList = this.updateProjectList.bind(this)
	}

	updateProjectList = () => {
		if (this.projectContainer === null) return

		this.projectContainer.empty()

		const outputButtons = (projectFiles: TFile[]) => {
			projectFiles.forEach((file) => {
				const button = this.projectContainer!.createEl('button', {
					text: file.basename,
				})
				button.onclick = () => {
					this.onSelect(file)
					this.close()
				}
			})
		}

		if (this.searchQuery) {
			const projectFiles = this.projectFiles
				.filter((file) =>
					file.basename.toLowerCase().includes(this.searchQuery),
				)
				.sort((a, b) => b.stat.mtime - a.stat.mtime)

			outputButtons(projectFiles)
		}

		const epoch = new Date()
		epoch.setDate(epoch.getDate() - 7)

		const recentProjectFiles = this.projectFiles
			.filter((file) => file.stat.mtime > epoch.getTime())
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
		const otherProjectFiles = this.projectFiles
			.filter((file) => file.stat.mtime <= epoch.getTime())
			.sort((a, b) => b.stat.mtime - a.stat.mtime)

		this.projectContainer.createEl('p', { text: 'Recent...' })
		outputButtons(recentProjectFiles)
		this.projectContainer.createEl('hr')
		outputButtons(otherProjectFiles)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.addClass('flow-project-modal-selector')

		contentEl.createEl('h2', { text: 'Select a Project' })

		const searchInput = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Search projects...',
		})
		searchInput.addClass('flow-search')
		searchInput.oninput = (e: Event) => {
			this.searchQuery = (
				e.target as HTMLInputElement
			).value.toLowerCase()
			this.updateProjectList()
		}

		this.projectContainer = contentEl.createDiv()
		this.projectContainer.addClass('flow-project-container')

		this.updateProjectList()
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
