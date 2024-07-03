import { Plugin, TFile, Notice } from 'obsidian'
import { getAPI, DataviewApi } from 'obsidian-dataview'

import { StateManager } from 'state'
import { type FlowSettings, DEFAULT_SETTINGS } from 'settings/settings'
import { FlowSettingsTab } from 'settings/settingsTab'
import { ProcessingView, PROCESSING_VIEW_TYPE } from 'views/processing'
import { SphereView, SPHERE_VIEW_TYPE } from 'views/sphere'
import { PlanningView, PLANNING_VIEW_TYPE } from 'views/planning'
import { registerCommands } from 'commands'
import { Store } from 'store'
import { Metrics } from 'metrics'
import { Tasks } from 'tasks'
import { getPlugin } from 'utils'
import { createEditorMenu } from 'editorMenu'

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

			this.app.workspace.on('editor-menu', (menu, editor) => {
				createEditorMenu(menu, editor, this)
			})

			this.setupWatchers()
		})
	}

	private checkDependencies(): boolean {
		const dependencyList = [
			'obsidian-tasks-plugin',
			'dataview',
			'templater-obsidian',
		]

		for (const dependency of dependencyList) {
			if (!getPlugin(dependency, this)) {
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
		await this.setupCountWatcher()
		await this.setupTaskWatcher()
	}

	private async setupCountWatcher() {
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

	private async setupTaskWatcher() {
		const cache = this.app.metadataCache

		const isFileToWatch = (file: TFile): boolean => {
			const fileCache = cache.getFileCache(file)
			if (fileCache !== null) {
				if (
					fileCache.frontmatter?.tags?.filter((t: string) =>
						t.startsWith('project/'),
					)
				) {
					return true
				}
			}

			if (file.path === this.settings.nextActionsFilePath) {
				return true
			}
			return false
		}

		this.registerEvent(
			// @ts-ignore FIXME: TS doesn't like the event type here
			this.app.vault.on('modify', async (file: TFile) => {
				if (isFileToWatch(file)) {
					const sphereLeaves =
						this.app.workspace.getLeavesOfType(SPHERE_VIEW_TYPE)
					for (const l of sphereLeaves) {
						const sphereView = l.view as SphereView
						setTimeout(function () {
							sphereView.render()
						}, 1000)
					}
				}
			}),
		)
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
		const loadedData = await this.loadData()
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			loadedData.settings || {},
		)
	}

	async saveSettings() {
		const currentData = await this.loadData()
		currentData.settings = this.settings
		await this.saveData(currentData)
	}

	onExternalSettingsChange() {
		this.loadSettings()
		// TODO: check if we need to reload the planning view (or anything else)
		// here
		// Maybe close the spheres too...? Make sure we don't throw the baby
		// out with the bathwater as (I think) this will fire whenever we save
		// a plannedTask...
	}

	onunload() {
		// Don't do things in here unless we're sure they loaded
	}
}
