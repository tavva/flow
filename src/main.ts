import { Plugin } from 'obsidian'
import { registerCommands } from './commands'
import { InboxProcessor } from './inboxProcessor'

export default class GTDPlugin extends Plugin {
	private inboxProcessor: InboxProcessor

	async onload() {
		console.log('Loading GTDPlugin')
		await this.loadSettings()
		this.inboxProcessor = new InboxProcessor(this.app, this)
		registerCommands(this, this.inboxProcessor)
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
