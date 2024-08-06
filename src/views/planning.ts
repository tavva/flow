import { ItemView, WorkspaceLeaf, type EventRef } from 'obsidian'

import FlowPlugin from 'main.js'
import store from 'svelteStore.js'
import PlanningViewComponent from 'components/PlanningView.svelte'

export const PLANNING_VIEW_TYPE = 'planning-view'

export async function closePlanningView(plugin: FlowPlugin) {
	const { workspace } = plugin.app

	const leaves = workspace.getLeavesOfType(PLANNING_VIEW_TYPE)
	for (const leaf of leaves) {
		leaf.detach()
	}
}

export async function openPlanningView(plugin: FlowPlugin) {
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
	private eventListenerRef: EventRef | null = null

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
		store.plugin.set(this.plugin)

		this.component = new PlanningViewComponent({
			target: this.contentEl,
			props: {
				plannedTasks: this.plugin.tasks.getPlannedTasks(),
			},
		})

		this.eventListenerRef = this.plugin.events.on(
			'planned-tasks-updated',
			() => {
				this.plugin.store.store({ 'last-task-planned': Date.now() })
				this.setProps({
					plannedTasks: this.plugin.tasks.getPlannedTasks(),
				})
			},
		)
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}

	async onClose() {
		if (this.eventListenerRef !== null) {
			this.plugin.events.offref(this.eventListenerRef)
			this.eventListenerRef = null
		}
	}
}
