import { Plugin } from 'obsidian'
import { registerCommands } from './commands'
import { StateManager } from './state'
import { FlowSettings, DEFAULT_SETTINGS } from './settings'
import { FlowSettingsTab } from './settingsTab'
import { StatusView, STATUS_VIEW_TYPE } from './views/status'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'

export default class FlowPlugin extends Plugin {
	private stateManager: StateManager
	settings: FlowSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new FlowSettingsTab(this.app, this))

		this.registerView(STATUS_VIEW_TYPE, (leaf) => new StatusView(leaf))
		this.registerView(
			PROCESSING_VIEW_TYPE,
			(leaf) => new ProcessingView(leaf),
		)

		this.stateManager = new StateManager(this.app, this)
		this.addCommand({
			id: 'process-inboxes',
			name: 'Process Inboxes',
			callback: () => this.stateManager.startProcessing(),
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
		this.app.workspace.detachLeavesOfType(STATUS_VIEW_TYPE)
		this.app.workspace.detachLeavesOfType(PROCESSING_VIEW_TYPE)
	}
}
