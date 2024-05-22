import { Plugin } from 'obsidian'
import { registerCommands } from './commands'
import { InboxProcessor } from './inboxProcessor'
import { GTDSettings, DEFAULT_SETTINGS } from './settings'
import { GTDSettingsTab } from './settingsTab'

export default class GTDPlugin extends Plugin {
	private inboxProcessor: InboxProcessor
	settings: GTDSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new GTDSettingTab(this.app, this))

		const stateManager = new StateManager(this.app, this)
		this.addCommand({
			id: 'process-inboxes',
			name: 'Process Inboxes',
			callback: () => stateManager.startProcessing(),
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
		console.log('Unloading GTDPlugin')
		this.inboxProcessor.cleanup()
	}
}
