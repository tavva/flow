import { ItemView, WorkspaceLeaf } from 'obsidian'

import FlowPlugin from '../main'
import { retrieve } from '../store'

import PlanningViewComponent from '../components/PlanningView.svelte'

export const PLANNING_VIEW_TYPE = 'planning-view'

export class PlanningView extends ItemView {
	private component: PlanningViewComponent
	plugin: FlowPlugin

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType() {
		return PLANNING_VIEW_TYPE
	}

	getDisplayText() {
		return 'Planning view'
	}

	async onOpen() {
		this.component = new PlanningViewComponent({
			target: this.contentEl,
			props: {
				tasks: await retrieve(this.plugin, 'plannedTasks'),
			},
		})
	}

	async onClose() {}
}
