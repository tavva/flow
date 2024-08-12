import { ItemView, WorkspaceLeaf } from 'obsidian'

import type FlowPlugin from 'main.js'
import store from 'svelteStore.js'
import SetupComponent from 'components/SetupView.svelte'

export const SETUP_VIEW_TYPE = 'setup-view'

export class SetupView extends ItemView {
	navigation = false

	plugin: FlowPlugin
	private component!: SetupComponent

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType() {
		return SETUP_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow setup'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		store.plugin.set(this.plugin)

		this.component = new SetupComponent({
			target: this.contentEl,
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}
}
