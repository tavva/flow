import { App, Modal, TFile } from 'obsidian'

export class ProjectSelectorModal extends Modal {
	private projectFiles: TFile[]
	private onSelect: (file: TFile) => void

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

		this.projectFiles.forEach((file) => {
			const button = contentEl.createEl('button', { text: file.basename })
			button.onclick = () => {
				this.onSelect(file)
				this.close()
			}
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
