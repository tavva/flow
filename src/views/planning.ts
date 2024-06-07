import * as fs from 'fs'

import { ItemView, WorkspaceLeaf, FileSystemAdapter } from 'obsidian'

import FlowPlugin from '../main'
import { retrieve } from '../store'

import PlanningViewComponent from '../components/PlanningView.svelte'
import { initializePlannedTasks } from '../tasks'

export const PLANNING_VIEW_TYPE = 'planning-view'

export class PlanningView extends ItemView {
	private component: PlanningViewComponent
	private watcher: fs.FSWatcher | null
	plugin: FlowPlugin

	constructor(leaf: WorkspaceLeaf, plugin: FlowPlugin) {
		super(leaf)
		this.plugin = plugin
		this.watcher = null
	}

	getViewType() {
		return PLANNING_VIEW_TYPE
	}

	getDisplayText() {
		return 'Planning view'
	}

	async onOpen() {
		initializePlannedTasks(this.plugin)

		this.component = new PlanningViewComponent({
			target: this.contentEl,
			props: {
				tasks: await retrieve(this.plugin, 'plannedTasks'),
			},
		})

		this.setupWatcher()
	}

	public setProps(props: Partial<typeof this.component.$$.props>) {
		if (this.component) {
			this.component.$set(props)
		}
	}

	private setupWatcher() {
		const dataPath = `${this.plugin.app.vault.configDir}/plugins/flow/data.json`
		const fullDataPath = (
			this.app.vault.adapter as FileSystemAdapter
		).getFullPath(dataPath)

		this.watcher = fs.watch(fullDataPath, async (_eventType, filename) => {
			if (filename) {
				this.setProps({
					tasks: await retrieve(this.plugin, 'plannedTasks'),
				})
			}
		})
	}

	async onClose() {
		this.watcher!.close()
	}
}
