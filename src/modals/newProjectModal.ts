import { App, Modal, Setting } from 'obsidian'

export class NewProjectModal extends Modal {
	private onSubmit: (projectName: string) => void
	private projectName: string = ''

	constructor(app: App, onSubmit: (projectName: string) => void) {
		super(app)
		this.onSubmit = onSubmit
	}

	onOpen() {
		const { contentEl } = this

		contentEl.createEl('h2', {
			text: 'Create a new project and add next action',
		})

		new Setting(contentEl).setName('Project name').addText((text) =>
			text.onChange((value) => {
				this.projectName = value
			}),
		)

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					if (this.projectName) {
						this.onSubmit(this.projectName)
						this.close()
					}
				}),
		)

		new Setting(contentEl).addButton((btn) =>
			btn.setButtonText('Cancel').onClick(() => {
				this.close()
			}),
		)
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
