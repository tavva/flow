import { ItemView, WorkspaceLeaf, TFile } from 'obsidian'

import type FlowPlugin from '../main.js'
import store from '../svelteStore.js'
import ProcessingViewComponent from '../components/ProcessingView.svelte'

export const PROCESSING_VIEW_TYPE = 'processing-view'

export class ProcessingView extends ItemView {
	navigation = false

	private plugin: FlowPlugin
	private component!: ProcessingViewComponent

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
		this.navigation = false
	}

	getViewType() {
		return PROCESSING_VIEW_TYPE
	}

	getDisplayText() {
		return 'Processing Flow inboxes'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		store.plugin.set(this.plugin)

		this.component = new ProcessingViewComponent({
			target: this.contentEl,
			props: {
				line: '',
				onAddToNextActions: () => {},
				onAddToProjectNextActions: () => {},
				onAddToPersonDiscussNext: () => {},
				onAddToSomeday: () => {},
				onTrash: () => {},
			},
		})
		this.plugin.stateManager.startProcessing()
	}

	async updateEmbeddedFile(notePath: string | null): Promise<void> {
		if (!notePath) {
			this.component.$set({
				noteContent: '',
				sourcePath: '',
			})
			return
		}

		const file = this.plugin.app.vault.getAbstractFileByPath(notePath)
		if (file instanceof TFile) {
			const content = await this.plugin.app.vault.read(file)
			if (this.component) {
				this.component.$set({
					noteContent: content,
					sourcePath: notePath,
				})
			}
		} else {
			const errorMessage = 'Note not found. Please check the file path.'
			if (this.component) {
				this.component.$set({
					noteContent: errorMessage,
					sourcePath: '',
				})
			}
		}
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}
}
