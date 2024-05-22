import { Plugin } from 'obsidian'
import { registerCommands } from './commands'
import { InboxProcessor } from './inboxProcessor'

export default class GTDPlugin extends Plugin {
	private inboxProcessor: InboxProcessor

	async onload() {
		console.log('Loading GTDPlugin')
		this.inboxProcessor = new InboxProcessor(this.app, this)
		registerCommands(this, this.inboxProcessor)
	}

	onunload() {
		console.log('Unloading GTDPlugin')
		this.inboxProcessor.cleanup()
	}
}
