import { Modal, ButtonComponent } from 'obsidian'

import type FlowPlugin from '../main.js'

export class AddFocusAreaModal extends Modal {
    private plugin: FlowPlugin
    private onSubmit: (focusAreaName: string) => void
    private warningEl!: HTMLElement | null

    constructor(plugin: FlowPlugin, onSubmit: (focusAreaName: string) => void) {
        super(plugin.app)
        this.plugin = plugin
        this.onSubmit = onSubmit
    }

    onOpen() {
        const { contentEl } = this
        contentEl.addClass('flow-modal')
        contentEl.addClass('flow-add-focus-area-modal')
        contentEl.createEl('h2', { text: 'Add a new focus area' })

        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'Enter focus area name',
        })
        input.focus()

        this.warningEl = contentEl.createDiv()
        this.warningEl.addClass('warning')
        this.warningEl.hide()

        const submitButton = new ButtonComponent(contentEl)
        submitButton
            .setButtonText('Add')
            .setCta()
            .onClick(() => {
                if (input.value === '') {
                    this.warningEl?.setText('Please enter a focus area name')
                    this.warningEl?.show()
                    return
                }
                this.onSubmit(input.value)
                this.close()
            })

        const cancelButton = new ButtonComponent(contentEl)
        cancelButton.setButtonText('Cancel')
        cancelButton.onClick(() => {
            this.close()
        })

        // Handle Enter key to submit
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (input.value === '') {
                    this.warningEl?.setText('Please enter a focus area name')
                    this.warningEl?.show()
                    return
                }
                this.onSubmit(input.value)
                this.close()
            }
        })
    }

    onClose() {
        const { contentEl } = this
        contentEl.empty()
    }
}
