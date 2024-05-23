import { App, Modal, TFile } from 'obsidian'

export class ProjectSelectorModal extends Modal {
	private projectFiles: TFile[]
	private onSelect: (file: TFile) => void
	private searchQuery: string = ''

	constructor(
		app: App,
		projectFiles: TFile[],
		onSelect: (file: TFile) => void,
	) {
		super(app)
		this.projectFiles = projectFiles
		this.onSelect = onSelect
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

		const projectContainer = contentEl.createDiv()
		projectContainer.addClass('project-container')

		this.updateProjectList = () => {
			projectContainer.empty()
			this.projectFiles
				.filter((file) =>
					file.basename.toLowerCase().includes(this.searchQuery),
				)
				.forEach((file) => {
					const button = projectContainer.createEl('button', {
						text: file.basename,
					})
					button.onclick = () => {
						this.onSelect(file)
						this.close()
					}
				})
		}

		this.updateProjectList()
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
