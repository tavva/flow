import { Plugin } from 'obsidian'
import { StateManager } from './state'
import { FlowSettings, DEFAULT_SETTINGS } from './settings/settings'
import { FlowSettingsTab } from './settings/settingsTab'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'
import { ProjectView, PROJECT_VIEW_TYPE } from './views/project'

export default class FlowPlugin extends Plugin {
	private stateManager: StateManager
	settings: FlowSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new FlowSettingsTab(this.app, this))

		this.registerView(
			PROCESSING_VIEW_TYPE,
			(leaf) => new ProcessingView(leaf),
		)

		this.registerView(
			PROJECT_VIEW_TYPE,
			(leaf) => new ProjectView(leaf),
		)

		this.stateManager = new StateManager(this)
		this.addCommand({
			id: 'process-inboxes',
			name: 'Process Inboxes',
			callback: () => this.stateManager.startProcessing(),
		})

		this.addCommand({
			id: 'view-personal-project',
			name: 'View Personal Project',
			callback: async () => {
				const leaf = this.app.workspace.getLeaf(false)
				await leaf.setViewState({
					type: PROJECT_VIEW_TYPE,
					active: true,
				})

				const view = leaf.view as ProjectView
				view.plugin = this
				view.context = 'personal'
				await view.render()
			}
		})

		this.registerEvent(
			this.app.workspace.on(
				'active-leaf-change',
				await this.onActiveLeafChange.bind(this),
			),
		)
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
		this.app.workspace.detachLeavesOfType(PROJECT_VIEW_TYPE)
	}
}
