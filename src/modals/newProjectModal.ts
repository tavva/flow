import { App, Modal, Setting, ButtonComponent } from 'obsidian'

export class NewProjectModal extends Modal {
	private contexts: string[]
	private selectedContexts: Set<string> = new Set()
	private onSubmit: (projectName: string, contexts: Set<string>) => void
	private projectName: string = ''
	private contextContainer: HTMLElement

	constructor(
		app: App,
		contexts: string[],
		onSubmit: (projectName: string) => void,
	) {
		super(app)
		this.contexts = contexts
		this.selectedContexts = new Set()
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

		this.contextContainer = contentEl.createDiv()
		this.contextContainer.addClass('flow-modal-content')

		const warningEl = contentEl.createDiv()
		warningEl.addClass('warning')

		this.contexts.forEach((context) => {
			const button = new ButtonComponent(this.contextContainer)
			button.setButtonText(context)

			button.onClick(() => {
				warningEl.hide()

				if (this.selectedContexts.has(context)) {
					this.selectedContexts.delete(context)
					button.buttonEl.removeClass('selected')
				} else {
					this.selectedContexts.add(context)
					button.setClass('selected')
				}
			})
		})

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(() => {
					if (this.selectedContexts.size === 0) {
						warningEl.setText('Please select at least one context')
						warningEl.show()
						return
					}
					if (!this.projectName) {
						warningEl.setText('Please enter a project name')
						warningEl.show()
						return
					}
					this.onSubmit(this.projectName, this.selectedContexts)
					this.close()
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
