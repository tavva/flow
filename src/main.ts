import * as fs from 'fs'

import { Plugin, FileSystemAdapter } from 'obsidian'
import { getAPI, DataviewApi } from 'obsidian-dataview'
import { StateManager } from './state'
import { FlowSettings, DEFAULT_SETTINGS } from './settings/settings'
import { FlowSettingsTab } from './settings/settingsTab'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'
import { SphereView, SPHERE_VIEW_TYPE } from './views/sphere'
import {
	PlanningView,
	openPlanningView,
	PLANNING_VIEW_TYPE,
} from './views/planning'
import { Store } from './store'
import { Metrics } from './metrics'
import { Tasks } from './tasks'

export default class FlowPlugin extends Plugin {
	private stateManager: StateManager
	private watchers: fs.FSWatcher[]
	dv: DataviewApi
	settings: FlowSettings
	store: Store
	metrics: Metrics
	tasks: Tasks

	private async openSphere(sphere: string) {
		return async () => {
			const existingLeaves =
				this.app.workspace.getLeavesOfType(SPHERE_VIEW_TYPE)

			for (const l of existingLeaves) {
				const sphereView = l.view as SphereView
				if (sphereView.sphere === sphere) {
					this.app.workspace.setActiveLeaf(l)
					return
				}
			}

			const leaf = this.app.workspace.getLeaf(false)
			await leaf.setViewState({
				type: SPHERE_VIEW_TYPE,
				active: true,
				state: { plugin: this, sphere: sphere },
			})

			const view = leaf.view as SphereView
			await view.render()
		}
	}

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new FlowSettingsTab(this.app, this))

		this.registerView(
			PROCESSING_VIEW_TYPE,
			(leaf) => new ProcessingView(leaf),
		)
		this.registerView(
			SPHERE_VIEW_TYPE,
			(leaf) => new SphereView(leaf, this),
		)
		this.registerView(
			PLANNING_VIEW_TYPE,
			(leaf) => new PlanningView(leaf, this),
		)

		this.dv = getAPI()
		this.stateManager = new StateManager(this)
		this.store = new Store(this)
		this.metrics = new Metrics(this)
		this.tasks = new Tasks(this)

		this.addCommand({
			id: 'process-inboxes',
			name: 'Process Inboxes',
			callback: () => this.stateManager.startProcessing(),
		})

		this.addCommand({
			id: 'view-personal-sphere',
			name: 'View Personal Sphere',
			callback: await this.openSphere('personal'),
		})

		this.addCommand({
			id: 'view-work-sphere',
			name: 'View Work Sphere',
			callback: await this.openSphere('work'),
		})

		this.addCommand({
			id: 'start-planning',
			name: 'Start Planning',
			callback: async () => {
				openPlanningView(this)
			},
		})

		this.registerEvent(
			this.app.workspace.on(
				'active-leaf-change',
				await this.onActiveLeafChange.bind(this),
			),
		)

		this.setupWatchers()
	}

	private async setupWatchers() {
		this.watchers = []

		const foldersToWatch = [
			this.settings.inboxFilesFolderPath,
			this.settings.inboxFolderPath,
		]

		foldersToWatch.forEach((folderPath) => {
			const folder = this.app.vault.getAbstractFileByPath(folderPath)
			if (!folder) {
				return
			}
			const folderPathFull = (
				this.app.vault.adapter as FileSystemAdapter
			).getFullPath(folder.path)

			const watcher = fs.watch(
				folderPathFull,
				{ recursive: false },
				async (_eventType, filename) => {
					if (filename) {
						await this.stateManager.updateCounts()
					}
				},
			)
			this.watchers.push(watcher)
		})
	}

	async onActiveLeafChange(leaf: any) {
		if (leaf.view.getViewType() === PROCESSING_VIEW_TYPE) {
			this.stateManager.startProcessing()
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(PROCESSING_VIEW_TYPE)
		this.app.workspace.detachLeavesOfType(SPHERE_VIEW_TYPE)
		this.app.workspace.detachLeavesOfType(PLANNING_VIEW_TYPE)
		this.watchers.forEach((watcher) => watcher.close())
	}
}
