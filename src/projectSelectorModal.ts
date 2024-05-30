import { App, Modal, TFile } from 'obsidian'

export class ProjectSelectorModal extends Modal {
	private projectFiles: TFile[]
	private onSelect: (file: TFile) => void
	private searchQuery: string = ''
	private projectContainer: HTMLElement

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
		this.projectContainer.empty()
		this.projectFiles
			.filter((file) =>
				file.basename.toLowerCase().includes(this.searchQuery),
			)
			.forEach((file) => {
				const button = this.projectContainer.createEl('button', {
					text: file.basename,
				})
				button.onclick = () => {
					this.onSelect(file)
					this.close()
				}
			})
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Select a Project' })

		const searchInput = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Search projects...',
		})
		searchInput.oninput = (e: Event) => {
			this.searchQuery = (
				e.target as HTMLInputElement
			).value.toLowerCase()
			this.updateProjectList()
		}

		this.projectContainer = contentEl.createDiv()
		this.projectContainer.addClass('project-container')

		this.updateProjectList()
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
