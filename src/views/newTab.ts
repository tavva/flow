import { ItemView, WorkspaceLeaf } from 'obsidian'

import type FlowPlugin from '../main.js'
import store from '../svelteStore.js'
import NewTabComponent from '../components/NewTabView.svelte'

export const NEW_TAB_VIEW_TYPE = 'new-tab-view'

export class NewTabView extends ItemView {
	plugin: FlowPlugin
	private component!: NewTabComponent

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType() {
		return NEW_TAB_VIEW_TYPE
	}

	getDisplayText() {
		return 'Flow new tab'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		store.plugin.set(this.plugin)

		this.component = new NewTabComponent({
			target: this.contentEl,
		})
	}

	async onClose() {
		if (this.component) {
			this.component.$destroy()
		}
	}
}
