import type FlowPlugin from 'main'
import { ItemView, WorkspaceLeaf } from 'obsidian'

export const SETUP_VIEW_TYPE = 'setup-view'

export class SetupView extends ItemView {
	plugin: FlowPlugin

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
}
