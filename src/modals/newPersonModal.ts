import { Modal, Setting } from 'obsidian'
import FlowPlugin from '../main.js'
import { getPersonFilePath } from '../utils.js'

export class NewPersonModal extends Modal {
    private plugin: FlowPlugin
    private onSubmit: (personName: string, description: string) => void
    private personName = ''
    private description = ''

    constructor(
        plugin: FlowPlugin,
        description: string,
        onSubmit: (personName: string, description: string) => void,
    ) {
        super(plugin.app)
        this.plugin = plugin
        this.description = description
        this.onSubmit = onSubmit
    }

    onOpen() {
        const { contentEl } = this
        contentEl.addClass('flow-modal')
        contentEl.addClass('flow-person-modal')
        contentEl.createEl('h2', { text: 'Create a new person' })
        new Setting(contentEl).setName('Person name').addText((text) =>
            text.onChange((val) => {
                this.personName = val.trim()
            }),
        )
        new Setting(contentEl).setName('Description').addTextArea((text) =>
            text.setValue(this.description).onChange((val) => {
                this.description = val
            }),
        )
        const warningEl = contentEl.createDiv()
        warningEl.addClass('warning')
        new Setting(contentEl).addButton((btn) =>
            btn
                .setButtonText('Create')
                .setCta()
                .onClick(async () => {
                    if (!this.personName) {
                        warningEl.setText('Please enter a person name')
                        warningEl.show()
                        return
                    }
                    if (await getPersonFilePath(this.plugin, this.personName)) {
                        warningEl.setText('Person already exists')
                        warningEl.show()
                        return
                    }
                    this.onSubmit(this.personName, this.description)
                    this.close()
                }),
        )
        new Setting(contentEl).addButton((btn) =>
            btn.setButtonText('Cancel').onClick(() => this.close()),
        )
    }

    onClose() {
        this.contentEl.empty()
    }
}
