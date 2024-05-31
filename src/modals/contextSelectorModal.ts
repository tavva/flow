import { Modal } from 'obsidian'

export class ContextSelectorModal extends Modal {
	private contexts: string[]
	private onSelect: (string: String) => void
	private contextContainer: HTMLElement

	constructor(
		app: App,
		contexts: string[],
		onSelect: (string: String) => void,
	) {
		super(app)
		this.contexts = contexts
		this.onSelect = onSelect
	}

	updateContextList = () => {}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Select a Context' })

		this.contextContainer.empty()
		this.contextContainer = contentEl.createDiv()
		this.contextContainer.addClass('context-container')

		this.contexts.forEach((context) => {
			const button = this.contextContainer.createEl('button', {
				text: context,
			})
			button.onclick = () => {
				this.onSelect(context)
				this.close()
			}
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
