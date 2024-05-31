import { Modal } from 'obsidian'

export class ContextSelectorModal extends Modal {
	private contexts: string[]
	private onSelect: (selected: string[] | string) => void
	private contextContainer: HTMLElement
	private multiSelect: boolean
	private selectedContexts: Set<string>

	constructor(
		app: App,
		contexts: string[],
		onSelect: (selected: string[] | string) => void,
		multiSelect: boolean = false,
	) {
		super(app)
		this.contexts = contexts
		this.onSelect = onSelect
		this.multiSelect = multiSelect
		this.selectedContexts = new Set()
	}

	updateContextList = () => {}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Select a Context' })

		this.contextContainer?.empty()
		this.contextContainer = contentEl.createDiv()
		this.contextContainer.addClass('context-container')

		this.contexts.forEach((context) => {
			const button = this.contextContainer.createEl('button', {
				text: context,
			})
			button.onclick = () => {
				if (this.multiSelect) {
					if (this.selectedContexts.has(context)) {
						this.selectedContexts.delete(context)
						button.removeClass('selected')
					} else {
						this.selectedContexts.add(context)
						button.addClass('selected')
					}
				} else {
					this.onSelect(context)
					this.close()
				}
			}
		})

		if (this.multiSelect) {
			const doneButton = contentEl.createEl('button', {
				text: 'Done',
			})
			doneButton.addEventListener('click', () => {
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
