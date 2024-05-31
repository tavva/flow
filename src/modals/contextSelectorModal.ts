import { Modal, ButtonComponent } from 'obsidian'

export class ContextSelectorModal extends Modal {
	private contexts: string[]
	private onSelect: (selected: string[]) => void
	private contextContainer: HTMLElement
	private multiSelect: boolean
	private selectedContexts: Set<string>

	constructor(
		app: App,
		contexts: string[],
		onSelect: (selected: string[]) => void,
		multiSelect: boolean = false,
	) {
		super(app)
		this.contexts = contexts
		this.onSelect = onSelect
		this.multiSelect = multiSelect
		this.selectedContexts = new Set()
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Select one or more contexts' })

		this.contextContainer?.empty()
		this.contextContainer = contentEl.createDiv()
		this.contextContainer.addClass('flow-modal-content')
		this.warningEl = contentEl.createDiv()
		this.warningEl.addClass('warning')

		this.contexts.forEach((context) => {
			const button = new ButtonComponent(this.contextContainer)
			button.setButtonText(context)

			button.onClick(() => {
				this.warningEl.hide()

				if (this.multiSelect) {
					if (this.selectedContexts.has(context)) {
						this.selectedContexts.delete(context)
						button.buttonEl.removeClass('selected')
					} else {
						this.selectedContexts.add(context)
						button.setClass('selected')
					}
				} else {
					this.onSelect([context])
					this.close()
				}
			})
		})

		if (this.multiSelect) {
			const doneButton = new ButtonComponent(contentEl)
			doneButton.setButtonText('Done')
			doneButton.setCta()

			doneButton.onClick(() => {
				if (this.selectedContexts.size === 0) {
					this.warningEl.setText('Please select at least one context')
					this.warningEl.show()
					return
				}
				this.onSelect(Array.from(this.selectedContexts))
				this.close()
			})
		}
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
