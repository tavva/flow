import { Plugin } from 'obsidian'
import { registerCommands } from './commands'
import { StateManager } from './state'
import { GTDSettings, DEFAULT_SETTINGS } from './settings'
import { GTDSettingsTab } from './settingsTab'
import { StatusView, STATUS_VIEW_TYPE } from './views/status'
import { ProcessingView, PROCESSING_VIEW_TYPE } from './views/processing'

export default class GTDPlugin extends Plugin {
	private stateManager: StateManager
	settings: GTDSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new GTDSettingsTab(this.app, this))

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

	onunload() {}
}
