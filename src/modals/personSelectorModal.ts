import { App, Modal, TFile } from 'obsidian'

export class PersonSelectorModal extends Modal {
	private personFiles: TFile[]
	private onSelect: (file: TFile) => void
	private searchQuery: string = ''
	private personContainer: HTMLElement | null = null

	constructor(
		app: App,
		personFiles: TFile[],
		onSelect: (file: TFile) => void,
	) {
		super(app)
		this.personFiles = personFiles
		this.onSelect = onSelect
		this.updatePersonList = this.updatePersonList.bind(this)
	}

	updatePersonList = () => {
		if (this.personContainer === null) return

		this.personContainer.empty()

		const outputButtons = (personFiles: TFile[]) => {
			personFiles.forEach((file) => {
				const button = this.personContainer!.createEl('button', {
					text: file.basename,
				})
				button.onclick = () => {
					this.onSelect(file)
					this.close()
				}
			})
		}

		if (this.searchQuery) {
			const personFiles = this.personFiles
				.filter((file) =>
					file.basename.toLowerCase().includes(this.searchQuery),
				)
				.sort((a, b) => b.stat.mtime - a.stat.mtime)

			outputButtons(personFiles)
		}

		const epoch = new Date()
		epoch.setDate(epoch.getDate() - 7)

		const recentPersonFiles = this.personFiles
			.filter((file) => file.stat.mtime > epoch.getTime())
			.sort((a, b) => b.stat.mtime - a.stat.mtime)
		const otherPersonFiles = this.personFiles
			.filter((file) => file.stat.mtime <= epoch.getTime())
			.sort((a, b) => b.stat.mtime - a.stat.mtime)

		this.personContainer.createEl('p', { text: 'Recent...' })
		outputButtons(recentPersonFiles)
		this.personContainer.createEl('hr')
		outputButtons(otherPersonFiles)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.addClass('flow-person-modal-selector')

		contentEl.createEl('h2', { text: 'Select a Person' })

		const searchInput = contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Search people...',
		})
		searchInput.addClass('flow-search')
		searchInput.oninput = (e: Event) => {
			this.searchQuery = (
				e.target as HTMLInputElement
			).value.toLowerCase()
			this.updatePersonList()
		}

		this.personContainer = contentEl.createDiv()
		this.personContainer.addClass('flow-person-container')

		this.updatePersonList()
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
