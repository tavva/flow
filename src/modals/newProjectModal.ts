import { App, Modal, Setting, ButtonComponent, debounce } from 'obsidian'
import { getProjectFilePath } from '../utils'
import FlowPlugin from '../main'

export class NewProjectModal extends Modal {
	private plugin: FlowPlugin
	private contexts: string[]
	// TODO: we only allow one context. This is a Set to match the
	// implementation in the ContextSelectorModal
	private selectedContexts: Set<string> = new Set()
	private onSubmit: (
		projectName: string,
		contexts: Set<string>,
		priority: number,
	) => void
	private projectName: string = ''
	private priority: number | undefined
	private contextContainer: HTMLElement
	private contextButtons: ButtonComponent[] = []

	constructor(
		plugin: FlowPlugin,
		onSubmit: (
			projectName: string,
			contexts: Set<string>,
			priority: number,
		) => void,
	) {
		super(plugin.app)
		this.plugin = plugin
		this.contexts = plugin.settings.contexts
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

				this.selectedContexts = new Set()

				for (const button of this.contextButtons) {
					button.buttonEl.removeClass('selected')
				}

				this.selectedContexts.add(context)
				button.setClass('selected')
			})

			this.contextButtons.push(button)
		})

		new Setting(contentEl).setName('Priority').addText((text) =>
			text.setPlaceholder('1-10').onChange(
				debounce(async (value) => {
					const num = parseInt(value)
					if (!isNaN(num) && num >= 1 && num <= 10) {
						warningEl.hide()
						this.priority = num
					} else {
						warningEl.setText(
							'Priority must be a number between 1 and 10',
						)
						warningEl.show()
						text.inputEl.value = this.priority?.toString() || ''
					}
				}, 500),
			),
		)

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText('Create')
				.setCta()
				.onClick(async () => {
					if (!this.projectName) {
						warningEl.setText('Please enter a project name')
						warningEl.show()
						return
					}
					if (this.selectedContexts.size !== 1) {
						warningEl.setText('Please select one context')
						warningEl.show()
						return
					}
					if (
						!this.priority ||
						this.priority < 1 ||
						this.priority > 10
					) {
						warningEl.setText(
							'Priority must be a number between 1 and 10',
						)
						warningEl.show()
						return
					}

					if (
						await getProjectFilePath(this.plugin, this.projectName)
					) {
						warningEl.setText('Project already exists')
						warningEl.show()
						return
					}

					this.onSubmit(
						this.projectName,
						this.selectedContexts,
						this.priority,
					)
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
