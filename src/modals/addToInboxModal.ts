import { Modal, ButtonComponent } from 'obsidian'

import type FlowPlugin from 'main.js'

export class AddToInboxModal extends Modal {
    private onSubmit: (content: string) => void
    private warningEl!: HTMLElement | null

    constructor(plugin: FlowPlugin, onSubmit: (content: string) => void) {
        super(plugin.app)
        this.onSubmit = onSubmit
    }

    onOpen() {
        const { contentEl } = this
        contentEl.addClass('flow-modal')
        contentEl.addClass('flow-add-to-inbox-modal')
        contentEl.createEl('h2', { text: 'Capture something into your inbox' })

        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'What do you want to capture?',
        })

        this.warningEl = contentEl.createDiv()
        this.warningEl.addClass('warning')

        const submitButton = new ButtonComponent(contentEl)
        submitButton.setButtonText('Capture').onClick(() => {
            console.log('input.value', input.value)
            if (input.value === '') {
                this.warningEl?.setText(
                    'Please add something you want to capture',
                )
                return
            }
            this.onSubmit(input.value)
            this.close()
        })

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
