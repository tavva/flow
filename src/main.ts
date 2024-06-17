import { Plugin, TFile, Notice } from 'obsidian'
import { getAPI, DataviewApi } from 'obsidian-dataview'
import { StateManager } from './state'
import { type FlowSettings, DEFAULT_SETTINGS } from './settings/settings'
import { FlowSettingsTab } from './settings/settingsTab'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'
import { SphereView, SPHERE_VIEW_TYPE } from './views/sphere'
import { PlanningView, PLANNING_VIEW_TYPE } from './views/planning'
import { registerCommands } from './commands'
import { Store } from './store'
import { Metrics } from './metrics'
import { Tasks } from './tasks'

export default class FlowPlugin extends Plugin {
	stateManager!: StateManager
	dv: DataviewApi
	settings!: FlowSettings
	store!: Store
	metrics!: Metrics
	tasks!: Tasks

	async onload() {
		this.app.workspace.onLayoutReady(async () => {
			if (!this.checkDependencies()) {
				return
			}
			await this.loadSettings()
			this.addSettingTab(new FlowSettingsTab(this))

			this.registerViews()

			this.dv = getAPI()
			this.stateManager = new StateManager(this)
			this.store = new Store(this)
			this.metrics = new Metrics(this)
			this.tasks = new Tasks(this)

			registerCommands(this)

			this.registerEvent(
				this.app.workspace.on(
					'active-leaf-change',
					this.onActiveLeafChange.bind(this),
				),
			)

			this.setupWatchers()
		})
	}

	private checkDependencies(): boolean {
		const dependencyList = ['tasks']

		for (const dependency of dependencyList) {
			// @ts-ignore -- plugins is on the App class, not sure why this
			// isn't picked up
			if (!this.app.plugins.plugins[dependency]) {
				new Notice(
					`Flow requires the ${dependency} plugin to be installed and enabled.`,
				)
				return false
			}
		}

		return true
	}

	private registerViews() {
		this.registerView(
			PROCESSING_VIEW_TYPE,
			(leaf) => new ProcessingView(leaf, this),
		)
		this.registerView(
			SPHERE_VIEW_TYPE,
			(leaf) => new SphereView(leaf, this),
		)
		this.registerView(
			PLANNING_VIEW_TYPE,
			(leaf) => new PlanningView(leaf, this),
		)
	}

	private async setupWatchers() {
		const foldersToWatch = [
			this.settings.inboxFilesFolderPath,
			this.settings.inboxFolderPath,
		]

		const eventTypes: Array<string> = ['modify', 'create', 'delete']

		foldersToWatch.forEach((folderPath) => {
			const folder = this.app.vault.getAbstractFileByPath(folderPath)
			if (!folder) {
				return
			}

			eventTypes.forEach((eventType) => {
				this.registerEvent(
					// @ts-ignore FIXME: TS doesn't like the event type here
					this.app.vault.on(eventType, async (file: TFile) => {
						if (file.path.startsWith(folder.path)) {
							await this.stateManager.updateCounts()
						}
					}),
				)
			})
		})
	}

	async onActiveLeafChange(leaf: any) {
		if (leaf.view.getViewType() === PROCESSING_VIEW_TYPE) {
			this.stateManager.startProcessing()
		}
	}

	async openSphere(sphere: string) {
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
		// Don't do things in here unless we're sure they loaded
	}
}
