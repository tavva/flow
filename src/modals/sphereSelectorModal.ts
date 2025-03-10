import { App, Modal, ButtonComponent } from 'obsidian'

export class SphereSelectorModal extends Modal {
    private spheres: string[]
    private onSubmit: (selected: string[]) => void
    private sphereContainer!: HTMLElement
    private selectedSpheres: Set<string>
    private warningEl!: HTMLElement | null

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
        contentEl.addClass('flow-modal')
        contentEl.createEl('h2', { text: 'Select one or more spheres' })

        this.sphereContainer = contentEl.createDiv()
        this.sphereContainer.addClass('flow-modal-content')
        this.sphereContainer.addClass('flow-modal-sphere-selector')

        this.warningEl = contentEl.createDiv()
        this.warningEl.addClass('warning')

        this.addSpheres()
        this.addDoneButton()
        this.addCancelButton()
    }

    addSpheres() {
        this.spheres.forEach((sphere) => {
            const button = new ButtonComponent(this.sphereContainer)
            button.setButtonText(sphere)

            button.onClick(() => {
                this.warningEl?.hide()

                if (this.selectedSpheres.has(sphere)) {
                    this.selectedSpheres.delete(sphere)
                    button.buttonEl.removeClass('selected')
                } else {
                    this.selectedSpheres.add(sphere)
                    button.setClass('selected')
                }
            })
        })
    }

    addDoneButton() {
        const { contentEl } = this

        const doneButton = new ButtonComponent(contentEl)
        doneButton.setButtonText('Done')
        doneButton.setCta()

        doneButton.onClick(() => {
            if (this.selectedSpheres.size === 0) {
                this.warningEl?.setText('Please select at least one sphere')
                this.warningEl?.show()
                return
            }
            this.onSubmit(Array.from(this.selectedSpheres))
            this.close()
        })
    }

    addCancelButton() {
        const { contentEl } = this

        const cancelButton = new ButtonComponent(contentEl)
        cancelButton.setButtonText('Cancel')
        cancelButton.setCta()

        cancelButton.onClick(() => {
            this.close()
        })
    }

    onClose() {
        const { contentEl } = this
        contentEl.empty()
    }
}
