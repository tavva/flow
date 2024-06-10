import { App, Modal, ButtonComponent } from 'obsidian'

export class SphereSelectorModal extends Modal {
	private spheres: string[]
	private onSubmit: (selected: string[]) => void
	private sphereContainer!: HTMLElement
	private selectedSpheres: Set<string>

	constructor(
		app: App,
		spheres: string[],
		onSubmit: (selected: string[]) => void,
	) {
		super(app)
		this.spheres = spheres
		this.onSubmit = onSubmit
		this.selectedSpheres = new Set()
	}

	onOpen() {
		const { contentEl } = this
		contentEl.createEl('h2', { text: 'Select one or more spheres' })

		this.sphereContainer = contentEl.createDiv()
		this.sphereContainer.addClass('flow-modal-content')

		const warningEl = contentEl.createDiv()
		warningEl.addClass('warning')

		this.spheres.forEach((sphere) => {
			const button = new ButtonComponent(this.sphereContainer)
			button.setButtonText(sphere)

			button.onClick(() => {
				warningEl.hide()

				if (this.selectedSpheres.has(sphere)) {
					this.selectedSpheres.delete(sphere)
					button.buttonEl.removeClass('selected')
				} else {
					this.selectedSpheres.add(sphere)
					button.setClass('selected')
				}
			})
		})

		const doneButton = new ButtonComponent(contentEl)
		doneButton.setButtonText('Done')
		doneButton.setCta()

		doneButton.onClick(() => {
			if (this.selectedSpheres.size === 0) {
				warningEl.setText('Please select at least one sphere')
				warningEl.show()
				return
			}
			this.onSubmit(Array.from(this.selectedSpheres))
			this.close()
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
