import { App, Notice } from 'obsidian'
import { StateManager } from './state'

export class InboxProcessor {
	private app: App
	private stateManager: StateManager

	constructor(app: App, plugin: Plugin) {
		this.app = app
		this.stateManager = new StateManager(app, plugin)
	}

	startProcessing() {
		if (
			this.stateManager.isInboxEmpty() &&
			this.stateManager.isEmailInboxEmpty()
		) {
			new Notice('Both inboxes are empty')
			return
		}

		this.stateManager.startProcessing()
	}

	cleanup() {}
}
