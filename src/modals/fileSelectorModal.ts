import { App, Modal, TFile } from 'obsidian'

export class FileSelectorModal extends Modal {
    private files: TFile[]
    private onSelect: (file: TFile) => void
    private searchTerm: string = ''
    private container: HTMLElement | null = null
    private heading: string
    private searchInputPlaceholder: string

    constructor(
        app: App,
        files: TFile[],
        onSelect: (file: TFile) => void,
        heading: string,
        searchInputPlaceholder: string,
    ) {
        super(app)
        this.files = files
        this.onSelect = onSelect
        this.updateList = this.updateList.bind(this)
        this.heading = heading
        this.searchInputPlaceholder = searchInputPlaceholder
    }

    updateList = () => {
        if (this.container === null) return

        this.container.empty()

        const outputButtons = (files: TFile[]) => {
            files.forEach((file) => {
                const button = this.container!.createEl('button', {
                    text: file.basename,
                })
                button.onclick = () => {
                    this.onSelect(file)
                    this.close()
                }
            })
        }

        if (this.searchTerm) {
            const files = this.files
                .filter((file) =>
                    file.basename.toLowerCase().includes(this.searchTerm),
                )
                .sort((a, b) => b.stat.mtime - a.stat.mtime)

            outputButtons(files)
        }

        const epoch = new Date()
        epoch.setDate(epoch.getDate() - 7)

        const recentFiles = this.files
            .filter((file) => file.stat.mtime > epoch.getTime())
            .sort((a, b) => b.stat.mtime - a.stat.mtime)
        const otherFiles = this.files
            .filter((file) => file.stat.mtime <= epoch.getTime())
            .sort((a, b) => b.stat.mtime - a.stat.mtime)

        this.container.createEl('p', { text: 'Recent...' })
        outputButtons(recentFiles)
        this.container.createEl('hr')
        outputButtons(otherFiles)
    }

    onOpen() {
        const { contentEl } = this
        contentEl.addClass('flow-files-modal-selector')

        contentEl.createEl('h2', { text: this.heading })

        const searchInput = contentEl.createEl('input', {
            type: 'text',
            placeholder: this.searchInputPlaceholder,
        })
        searchInput.addClass('flow-search')
        searchInput.oninput = (e: Event) => {
            this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase()
            this.updateList()
        }

        this.container = contentEl.createDiv()
        this.container.addClass('flow-files-container')

        this.updateList()
    }

    onClose() {
        const { contentEl } = this
        contentEl.empty()
    }
}
