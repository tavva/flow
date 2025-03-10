import FlowPlugin from '../../main.js'
import { AbstractInputSuggest, TAbstractFile, TFolder } from 'obsidian'

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
    constructor(
        public plugin: FlowPlugin,
        public inputEl: HTMLInputElement,
    ) {
        super(plugin.app, inputEl)
    }

    getSuggestions(inputStr: string): TFolder[] {
        const abstractFiles = this.plugin.app.vault.getAllLoadedFiles()
        const folders: TFolder[] = []
        const lowerCaseInputStr = inputStr.toLowerCase()

        abstractFiles.forEach((folder: TAbstractFile) => {
            if (
                folder instanceof TFolder &&
                folder.path.toLowerCase().contains(lowerCaseInputStr)
            ) {
                folders.push(folder)
            }
        })

        return folders.slice(0, 1000)
    }

    renderSuggestion(file: TFolder, el: HTMLElement): void {
        el.setText(file.path)
    }

    selectSuggestion(file: TFolder): void {
        this.inputEl.value = file.path
        this.inputEl.trigger('input')
        this.close()
    }
}
