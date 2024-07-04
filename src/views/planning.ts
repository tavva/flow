import { ItemView, WorkspaceLeaf } from 'obsidian'

import FlowPlugin from 'main'

import PlanningViewComponent from 'components/PlanningView.svelte'

export const PLANNING_VIEW_TYPE = 'planning-view'

async function clearStalePlannedTasks(plugin: FlowPlugin): Promise<void> {
	const lastTaskPlanned = await plugin.store.retrieve('last-task-planned')
	if (lastTaskPlanned && lastTaskPlanned !== new Date().toDateString()) {
		await plugin.tasks.clearTasks()
	}
}

export async function openPlanningView(plugin: FlowPlugin) {
	clearStalePlannedTasks(plugin)

	const { workspace } = plugin.app

	let leaf: WorkspaceLeaf | null = null
	const leaves = workspace.getLeavesOfType(PLANNING_VIEW_TYPE)

	if (leaves.length > 0) {
		leaf = leaves[0]
	} else {
		leaf = workspace.getRightLeaf(false)
		await leaf!.setViewState({
			type: PLANNING_VIEW_TYPE,
			active: true,
		})
	}

	if (!leaf) {
		console.error('Could not find or create a leaf for the planning view')
		return
	}

	workspace.revealLeaf(leaf)
}

export class PlanningView extends ItemView {
	private component!: PlanningViewComponent
	plugin: FlowPlugin

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getViewType() {
		return PLANNING_VIEW_TYPE
	}

	getDisplayText() {
		return 'Planned actions'
	}

	override getIcon(): string {
		return 'waves'
	}

	async onOpen() {
		this.component = new PlanningViewComponent({
			target: this.contentEl,
			props: {
				tasks: await this.plugin.store.retrieve('plannedTasks'),
				plugin: this.plugin,
			},
		})
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}

	async onClose() {}
}
