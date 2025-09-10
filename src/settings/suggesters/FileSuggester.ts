import { TAbstractFile, TFile, AbstractInputSuggest } from 'obsidian'

import FlowPlugin from '../../main.js'

export class FileSuggest extends AbstractInputSuggest<TFile> {
    constructor(
        public plugin: FlowPlugin,
        public inputEl: HTMLInputElement,
    ) {
        super(plugin.app, inputEl)
    }

    getSuggestions(input_str: string): TFile[] {
        const allFiles = this.plugin.app.vault.getMarkdownFiles()
        const lower = input_str.toLowerCase()

        const files: TFile[] = []
        allFiles.forEach((file: TAbstractFile) => {
            if (
                file instanceof TFile &&
                file.extension === 'md' &&
                file.path.toLowerCase().includes(lower)
            ) {
                files.push(file)
            }
        })

        return files.slice(0, 1000)
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.setText(file.path)
    }

    selectSuggestion(file: TFile): void {
        this.inputEl.value = file.path
        this.inputEl.trigger('input')
        this.close()
    }
}
